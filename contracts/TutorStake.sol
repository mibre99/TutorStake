// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TutorStake — escrow for tutoring, released a lesson at a time
/// @notice A student opens a plan with a tutor (a subject, a price per session, and a number of
///         sessions) and deposits the full amount in USDC. After each lesson the tutor marks it done
///         and the student confirms — releasing one session's pay to the tutor instantly. The student
///         can cancel a marked lesson that didn't happen — it's refunded and dropped from the plan, so a
///         lesson can't be contested forever; if they go silent instead, anyone (a keeper or an agent)
///         can settle the marked session after a confirmation window, so the tutor still gets paid.
///         The student can close the plan any time it isn't mid-session and reclaim the unused sessions.
///         Built for ARC: lessons settle in native USDC, instantly, with no platform in the middle.
contract TutorStake {
    uint8 public constant ACTIVE = 1;
    uint8 public constant CLOSED = 2;
    uint64 public constant CONFIRM_WINDOW = 1 days;

    struct Plan {
        uint256 id;
        address student;
        address tutor;
        string subject;
        uint256 price;     // USDC per session (native, 18 decimals)
        uint32 sessions;   // total sessions funded
        uint32 paid;       // sessions released to the tutor
        uint8 pending;     // 1 if a session is marked and awaiting the student's confirmation
        uint64 markedAt;   // when the pending session was marked done
        uint64 createdAt;
        uint8 status;      // ACTIVE / CLOSED
    }

    uint256 public planCount;
    uint256 public totalEscrowed;  // lifetime USDC deposited
    uint256 public totalReleased;  // lifetime USDC paid to tutors
    uint256 public totalRefunded;  // lifetime USDC returned to students
    uint256 public sessionsPaid;   // lifetime sessions released

    mapping(uint256 => Plan) public plans;
    mapping(address => uint256[]) private _asStudent;
    mapping(address => uint256[]) private _asTutor;
    mapping(address => uint256) public tutorEarned;

    event Opened(uint256 indexed id, address indexed student, address indexed tutor, string subject, uint256 price, uint32 sessions);
    event Marked(uint256 indexed id, address indexed tutor, uint32 session);
    event Released(uint256 indexed id, address indexed tutor, uint32 session, uint256 amount, bool autoSettled);
    event Rejected(uint256 indexed id, address indexed student, uint32 session);
    event Closed(uint256 indexed id, uint256 refunded);

    /// @notice Open a plan with a tutor and deposit the full cost (price × sessions).
    function openPlan(address tutor, string calldata subject, uint256 price, uint32 sessions) external payable returns (uint256) {
        require(tutor != address(0) && tutor != msg.sender, "bad tutor");
        require(price > 0 && sessions > 0 && sessions <= 1000, "bad terms");
        require(bytes(subject).length > 0 && bytes(subject).length <= 80, "bad subject");
        require(msg.value == price * sessions, "send price x sessions");

        uint256 id = ++planCount;
        Plan storage p = plans[id];
        p.id = id;
        p.student = msg.sender;
        p.tutor = tutor;
        p.subject = subject;
        p.price = price;
        p.sessions = sessions;
        p.createdAt = uint64(block.timestamp);
        p.status = ACTIVE;

        _asStudent[msg.sender].push(id);
        _asTutor[tutor].push(id);
        totalEscrowed += msg.value;
        emit Opened(id, msg.sender, tutor, subject, price, sessions);
        return id;
    }

    /// @notice Tutor marks the next lesson as done (one pending session at a time).
    function markDone(uint256 id) external {
        Plan storage p = plans[id];
        require(p.tutor == msg.sender, "not the tutor");
        require(p.status == ACTIVE, "not active");
        require(p.pending == 0, "session awaiting confirm");
        require(p.paid < p.sessions, "all sessions done");
        p.pending = 1;
        p.markedAt = uint64(block.timestamp);
        emit Marked(id, msg.sender, p.paid + 1);
    }

    /// @notice Student confirms the marked lesson — releases one session's pay to the tutor.
    function confirm(uint256 id) external {
        Plan storage p = plans[id];
        require(p.student == msg.sender, "not the student");
        require(p.pending == 1, "nothing to confirm");
        _release(p, false);
    }

    /// @notice Settle a marked lesson the student never confirmed, after the window — anyone can call it.
    function settle(uint256 id) external {
        Plan storage p = plans[id];
        require(p.pending == 1, "nothing to settle");
        require(block.timestamp > p.markedAt + CONFIRM_WINDOW, "still in window");
        _release(p, true);
    }

    /// @notice Student cancels the marked lesson (it didn't happen): refunds that lesson and removes it
    ///         from the plan, so the same session can't be marked and contested forever.
    function reject(uint256 id) external {
        Plan storage p = plans[id];
        require(p.student == msg.sender, "not the student");
        require(p.pending == 1, "nothing to reject");

        uint256 refund = p.price;
        uint32 session = p.paid + 1;

        // effects (checks-effects-interactions)
        p.pending = 0;
        p.sessions -= 1;                              // drop the cancelled lesson from the plan
        totalRefunded += refund;
        if (p.paid >= p.sessions) p.status = CLOSED;  // nothing left to teach

        // interaction
        (bool ok, ) = payable(p.student).call{value: refund}("");
        require(ok, "refund failed");
        emit Rejected(id, msg.sender, session);
    }

    /// @notice Student closes the plan (when no session is pending) and reclaims the unused sessions.
    function closePlan(uint256 id) external {
        Plan storage p = plans[id];
        require(p.student == msg.sender, "not the student");
        require(p.status == ACTIVE, "not active");
        require(p.pending == 0, "session awaiting confirm");

        uint256 refund = uint256(p.sessions - p.paid) * p.price;
        p.status = CLOSED;
        if (refund > 0) {
            totalRefunded += refund;
            (bool ok, ) = payable(p.student).call{value: refund}("");
            require(ok, "refund failed");
        }
        emit Closed(id, refund);
    }

    function _release(Plan storage p, bool autoSettled) private {
        uint256 amount = p.price;
        uint32 session = p.paid + 1;

        // effects (checks-effects-interactions)
        p.paid += 1;
        p.pending = 0;
        if (p.paid == p.sessions) p.status = CLOSED;
        sessionsPaid += 1;
        totalReleased += amount;
        tutorEarned[p.tutor] += amount;

        // interaction
        (bool ok, ) = payable(p.tutor).call{value: amount}("");
        require(ok, "pay failed");
        emit Released(p.id, p.tutor, session, amount, autoSettled);
    }

    // ── views ──────────────────────────────────────────────
    function getPlan(uint256 id) external view returns (Plan memory) {
        return plans[id];
    }

    function plansOf(address student) external view returns (uint256[] memory) {
        return _asStudent[student];
    }

    function teachingOf(address tutor) external view returns (uint256[] memory) {
        return _asTutor[tutor];
    }
}
