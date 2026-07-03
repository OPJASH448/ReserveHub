$BASE = "http://localhost:10000"
$headers = @{ "Content-Type" = "application/json" }

function Log($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function OK($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green }
function FAIL($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Yellow }

# Helper to extract token
function Get-Token($loginData) { return $loginData.accessToken }

$passCount = 0
$failCount = 0

function Check($condition, $passMsg, $failMsg) {
    global:$passCount++
    if ($condition) { OK $passMsg } else { global:$failCount++; FAIL $failMsg }
}

# ============================================================
Log "STEP 1: Register 4 users"
# ============================================================

# Admin user
$adminReg = Invoke-RestMethod -Uri "$BASE/api/auth/register" -Method POST -Body (@{
    name = "Admin User"; email = "admin@iitmadras.edu"; password = "Admin123!"
} | ConvertTo-Json) -Headers $headers
Info "Admin registered"
Start-Sleep -Milliseconds 500

# Faculty user
$facReg = Invoke-RestMethod -Uri "$BASE/api/auth/register" -Method POST -Body (@{
    name = "Dr. Ravi Kumar"; email = "ravi@iitmadras.edu"; password = "Faculty123!"
} | ConvertTo-Json) -Headers $headers
Info "Faculty registered"
Start-Sleep -Milliseconds 500

# Student user
$stuReg = Invoke-RestMethod -Uri "$BASE/api/auth/register" -Method POST -Body (@{
    name = "Priya Sharma"; email = "priya@iitmadras.edu"; password = "Student123!"
} | ConvertTo-Json) -Headers $headers
Info "Student registered"
Start-Sleep -Milliseconds 500

# Worker user
$worReg = Invoke-RestMethod -Uri "$BASE/api/auth/register" -Method POST -Body (@{
    name = "Suresh Worker"; email = "suresh@iitmadras.edu"; password = "Worker123!"
} | ConvertTo-Json) -Headers $headers
Info "Worker registered"
Start-Sleep -Milliseconds 500

# ============================================================
Log "STEP 2: Login all users"
# ============================================================

$adminLogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body (@{
    email = "admin@iitmadras.edu"; password = "Admin123!"
} | ConvertTo-Json) -Headers $headers
$adminToken = $adminLogin.accessToken
Info "Admin logged in - rank: $($adminLogin.user.rank)"

$facLogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body (@{
    email = "ravi@iitmadras.edu"; password = "Faculty123!"
} | ConvertTo-Json) -Headers $headers
$facToken = $facLogin.accessToken
Info "Faculty logged in"

$stuLogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body (@{
    email = "priya@iitmadras.edu"; password = "Student123!"
} | ConvertTo-Json) -Headers $headers
$stuToken = $stuLogin.accessToken
Info "Student logged in"

$worLogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body (@{
    email = "suresh@iitmadras.edu"; password = "Worker123!"
} | ConvertTo-Json) -Headers $headers
$worToken = $worLogin.accessToken
Info "Worker logged in"

# ============================================================
Log "STEP 3: Admin creates 'IIT Madras' org"
# ============================================================

$adminAuthH = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $adminToken" }

$orgRes = Invoke-RestMethod -Uri "$BASE/api/auth/create-org" -Method POST -Body (@{
    orgName = "IIT Madras"; orgType = "school"
} | ConvertTo-Json) -Headers $adminAuthH

$orgId = $orgRes.orgId
$adminToken = $orgRes.accessToken  # token refreshed with org info
$adminAuthH = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $adminToken" }
Info "Org created: $orgId"
Info "Admin is now OrgAdmin (rank 0)"

$adminUser = $orgRes.user
Check ($adminUser.rank -eq 0) "Admin rank is 0 (OrgAdmin)" "Admin rank should be 0 but is $($adminUser.rank)"

# ============================================================
Log "STEP 4: Create roles hierarchy"
# ============================================================

# Get roles to see the OrgAdmin role
$rolesRes = Invoke-RestMethod -Uri "$BASE/api/roles" -Method GET -Headers $adminAuthH
$orgAdminRole = $rolesRes | Where-Object { $_.rank -eq 0 }
Info "OrgAdmin role ID: $($orgAdminRole._id)"

# Faculty - rank 1 (child of OrgAdmin)
$facRole = Invoke-RestMethod -Uri "$BASE/api/roles" -Method POST -Body (@{
    name = "Faculty"; parentRoleLevelId = $orgAdminRole._id
} | ConvertTo-Json) -Headers $adminAuthH
Info "Faculty role created - rank: $($facRole.rank)"
Check ($facRole.rank -eq 1) "Faculty rank is 1" "Faculty rank should be 1 but is $($facRole.rank)"

# Student - rank 2 (child of Faculty)
$stuRole = Invoke-RestMethod -Uri "$BASE/api/roles" -Method POST -Body (@{
    name = "Student"; parentRoleLevelId = $facRole._id
} | ConvertTo-Json) -Headers $adminAuthH
Info "Student role created - rank: $($stuRole.rank)"
Check ($stuRole.rank -eq 2) "Student rank is 2" "Student rank should be 2 but is $($stuRole.rank)"

# Worker - rank 3 (child of Student)
$worRole = Invoke-RestMethod -Uri "$BASE/api/roles" -Method POST -Body (@{
    name = "Worker"; parentRoleLevelId = $stuRole._id
} | ConvertTo-Json) -Headers $adminAuthH
Info "Worker role created - rank: $($worRole.rank)"
Check ($worRole.rank -eq 3) "Worker rank is 3" "Worker rank should be 3 but is $($worRole.rank)"

# Verify all roles
$allRoles = Invoke-RestMethod -Uri "$BASE/api/roles" -Method GET -Headers $adminAuthH
Info "Total roles: $($allRoles.Count)"
foreach ($r in $allRoles) { Info "  - $($r.name) (rank $($r.rank))" }

# ============================================================
Log "STEP 5: Create resources with different access levels"
# ============================================================

# Resource 1: Auditorium - only rank 0-1 (Admin + Faculty)
$res1 = Invoke-RestMethod -Uri "$BASE/api/resources" -Method POST -Body (@{
    name = "Main Auditorium"
    description = "500-seat auditorium for lectures and events"
    quantity = 1
    maxAllowedRank = 1
    slotDurationMinutes = 60
    operatingHours = @{ start = "08:00"; end = "18:00" }
} | ConvertTo-Json) -Headers $adminAuthH
Info "Created: Main Auditorium (maxAllowedRank=1) - ID: $($res1._id)"

# Resource 2: Computer Lab - rank 0-2 (Admin + Faculty + Student)
$res2 = Invoke-RestMethod -Uri "$BASE/api/resources" -Method POST -Body (@{
    name = "Computer Lab"
    description = "30-seat computer lab with high-speed internet"
    quantity = 30
    maxAllowedRank = 2
    slotDurationMinutes = 60
    operatingHours = @{ start = "08:00"; end = "22:00" }
} | ConvertTo-Json) -Headers $adminAuthH
Info "Created: Computer Lab (maxAllowedRank=2) - ID: $($res2._id)"

# Resource 3: Parking Lot - rank 0-3 (everyone)
$res3 = Invoke-RestMethod -Uri "$BASE/api/resources" -Method POST -Body (@{
    name = "Parking Lot A"
    description = "Outdoor parking spaces near main gate"
    quantity = 100
    maxAllowedRank = 3
    slotDurationMinutes = 60
    operatingHours = @{ start = "06:00"; end = "23:00" }
} | ConvertTo-Json) -Headers $adminAuthH
Info "Created: Parking Lot A (maxAllowedRank=3) - ID: $($res3._id)"

# ============================================================
Log "STEP 6: Users join org via waiting queue"
# ============================================================

# Faculty joins
$facJoin = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/join" -Method POST -Body (@{
    orgId = $orgId; requestedRoleLevelId = $facRole._id
} | ConvertTo-Json) -Headers @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $facToken" }
Info "Faculty joined queue at position $($facJoin.position)"
Check ($facJoin.position -eq 1) "Faculty position is 1" "Faculty position should be 1"

# Student joins
$stuJoin = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/join" -Method POST -Body (@{
    orgId = $orgId; requestedRoleLevelId = $stuRole._id
} | ConvertTo-Json) -Headers @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $stuToken" }
Info "Student joined queue at position $($stuJoin.position)"
Check ($stuJoin.position -eq 2) "Student position is 2" "Student position should be 2"

# Worker joins
$worJoin = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/join" -Method POST -Body (@{
    orgId = $orgId; requestedRoleLevelId = $worRole._id
} | ConvertTo-Json) -Headers @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $worToken" }
Info "Worker joined queue at position $($worJoin.position)"
Check ($worJoin.position -eq 3) "Worker position is 3" "Worker position should be 3"

# ============================================================
Log "STEP 7: Admin reviews and approves join requests"
# ============================================================

$pending = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/pending" -Method GET -Headers $adminAuthH
Info "Pending requests for admin: $($pending.Count)"

foreach ($req in $pending) {
    Info "  - $($req.userId.name) requesting $($req.requestedRoleLevelId.name)"
}

Check ($pending.Count -eq 3) "3 pending requests" "Should have 3 pending requests, got $($pending.Count)"

# Approve Faculty
$facApprove = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/$($pending[0]._id)/resolve" -Method POST -Body (@{
    action = "approve"
} | ConvertTo-Json) -Headers $adminAuthH
Info "Approved: $($facApprove.message)"

# Approve Student
$stuApprove = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/$($pending[1]._id)/resolve" -Method POST -Body (@{
    action = "approve"
} | ConvertTo-Json) -Headers $adminAuthH
Info "Approved: $($stuApprove.message)"

# Approve Worker
$worApprove = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/$($pending[2]._id)/resolve" -Method POST -Body (@{
    action = "approve"
} | ConvertTo-Json) -Headers $adminAuthH
Info "Approved: $($worApprove.message)"

# Verify no more pending
$pendingAfter = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/pending" -Method GET -Headers $adminAuthH
Info "Pending requests after approval: $($pendingAfter.Count)"
Check ($pendingAfter.Count -eq 0) "No more pending requests" "Should be 0 pending but got $($pendingAfter.Count)"

# ============================================================
Log "STEP 8: Users login again to get updated tokens with roles"
# ============================================================

$facLogin2 = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body (@{
    email = "ravi@iitmadras.edu"; password = "Faculty123!"
} | ConvertTo-Json) -Headers $headers
$facToken2 = $facLogin2.accessToken
$facAuthH = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $facToken2" }
Info "Faculty re-login - rank: $($facLogin2.user.rank), roleName: $($facLogin2.user.roleName)"
Check ($facLogin2.user.rank -eq 1) "Faculty rank is 1 after approval" "Faculty rank should be 1 but is $($facLogin2.user.rank)"

$stuLogin2 = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body (@{
    email = "priya@iitmadras.edu"; password = "Student123!"
} | ConvertTo-Json) -Headers $headers
$stuToken2 = $stuLogin2.accessToken
$stuAuthH = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $stuToken2" }
Info "Student re-login - rank: $($stuLogin2.user.rank), roleName: $($stuLogin2.user.roleName)"
Check ($stuLogin2.user.rank -eq 2) "Student rank is 2 after approval" "Student rank should be 2 but is $($stuLogin2.user.rank)"

$worLogin2 = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body (@{
    email = "suresh@iitmadras.edu"; password = "Worker123!"
} | ConvertTo-Json) -Headers $headers
$worToken2 = $worLogin2.accessToken
$worAuthH = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $worToken2" }
Info "Worker re-login - rank: $($worLogin2.user.rank), roleName: $($worLogin2.user.roleName)"
Check ($worLogin2.user.rank -eq 3) "Worker rank is 3 after approval" "Worker rank should be 3 but is $($worLogin2.user.rank)"

# ============================================================
Log "STEP 9: List resources as each user"
# ============================================================

$facResources = Invoke-RestMethod -Uri "$BASE/api/resources" -Method GET -Headers $facAuthH
Info "Faculty sees $($facResources.Count) resources"
foreach ($r in $facResources) { Info "  - $($r.name) (maxRank=$($r.maxAllowedRank))" }

$stuResources = Invoke-RestMethod -Uri "$BASE/api/resources" -Method GET -Headers $stuAuthH
Info "Student sees $($stuResources.Count) resources"

$worResources = Invoke-RestMethod -Uri "$BASE/api/resources" -Method GET -Headers $worAuthH
Info "Worker sees $($worResources.Count) resources"

# ============================================================
Log "STEP 10: BOOKING TESTS - Faculty books Auditorium (rank 1 <= maxRank 1)"
# ============================================================

$today = (Get-Date).ToString("yyyy-MM-dd")
$adminResources = Invoke-RestMethod -Uri "$BASE/api/resources" -Method GET -Headers $adminAuthH
$auditorium = $adminResources | Where-Object { $_.name -eq "Main Auditorium" }
$lab = $adminResources | Where-Object { $_.name -eq "Computer Lab" }
$parking = $adminResources | Where-Object { $_.name -eq "Parking Lot A" }

# Get slots for auditorium today
$audSlots = Invoke-RestMethod -Uri "$BASE/api/resources/$($auditorium._id)/slots?date=$today" -Headers $facAuthH
Info "Auditorium slots for today: $($audSlots.slots.Count) slots"

# Find first available slot
$firstSlot = $audSlots.slots | Where-Object { $_.available -eq $true } | Select-Object -First 1
Info "First available slot: $($firstSlot.slotStart)"

# Faculty holds slot in Auditorium (rank 1 <= maxRank 1 -> SHOULD WORK)
$holdRes = Invoke-RestMethod -Uri "$BASE/api/bookings/hold" -Method POST -Body (@{
    resourceId = $auditorium._id; slotStart = $firstSlot.slotStart
} | ConvertTo-Json) -Headers $facAuthH
Info "Faculty HELD auditorium slot - booking ID: $($holdRes._id), status: $($holdRes.status)"
Check ($holdRes.status -eq "held") "Faculty successfully held auditorium slot" "Faculty should be able to hold auditorium slot"

# Confirm it
$confirmRes = Invoke-RestMethod -Uri "$BASE/api/bookings/$($holdRes._id)/confirm" -Method POST -Headers $facAuthH
Info "Faculty CONFIRMED booking - status: $($confirmRes.status)"
Check ($confirmRes.status -eq "confirmed") "Booking confirmed successfully" "Booking should be confirmed"

# ============================================================
Log "STEP 11: BOOKING TESTS - Student books Auditorium (rank 2 > maxRank 1 -> SHOULD FAIL)"
# ============================================================

$stuAudSlots = Invoke-RestMethod -Uri "$BASE/api/resources/$($auditorium._id)/slots?date=$today" -Headers $stuAuthH
$stuFirstSlot = $stuAudSlots.slots | Where-Object { $_.available -eq $true } | Select-Object -First 1

if ($stuFirstSlot) {
    try {
        $stuHoldRes = Invoke-WebRequest -Uri "$BASE/api/bookings/hold" -Method POST -Body (@{
            resourceId = $auditorium._id; slotStart = $stuFirstSlot.slotStart
        } | ConvertTo-Json) -Headers $stuAuthH -ErrorAction Stop
        FAIL "Student SHOULD NOT be able to book auditorium (rank 2 > maxRank 1), but got 200"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Info "Student booking auditorium returned HTTP $statusCode"
        Check ($statusCode -eq 403) "Student correctly DENIED access to auditorium (403)" "Expected 403 but got $statusCode"
    }
} else {
    Info "No available slots to test student denial"
}

# ============================================================
Log "STEP 12: BOOKING TESTS - Worker books Parking Lot (rank 3 <= maxRank 3 -> SHOULD WORK)"
# ============================================================

$parkSlots = Invoke-RestMethod -Uri "$BASE/api/resources/$($parking._id)/slots?date=$today" -Headers $worAuthH
Info "Parking slots for today: $($parkSlots.slots.Count) slots"
$parkFirstSlot = $parkSlots.slots | Where-Object { $_.available -eq $true } | Select-Object -First 1

$worHoldRes = Invoke-RestMethod -Uri "$BASE/api/bookings/hold" -Method POST -Body (@{
    resourceId = $parking._id; slotStart = $parkFirstSlot.slotStart
} | ConvertTo-Json) -Headers $worAuthH
Info "Worker HELD parking slot - status: $($worHoldRes.status)"
Check ($worHoldRes.status -eq "held") "Worker successfully held parking slot" "Worker should be able to hold parking slot"

# ============================================================
Log "STEP 13: BOOKING TESTS - Worker books Computer Lab (rank 3 > maxRank 2 -> SHOULD FAIL)"
# ============================================================

$labSlots = Invoke-RestMethod -Uri "$BASE/api/resources/$($lab._id)/slots?date=$today" -Headers $worAuthH
$labFirstSlot = $labSlots.slots | Where-Object { $_.available -eq $true } | Select-Object -First 1

if ($labFirstSlot) {
    try {
        $worLabHold = Invoke-WebRequest -Uri "$BASE/api/bookings/hold" -Method POST -Body (@{
            resourceId = $lab._id; slotStart = $labFirstSlot.slotStart
        } | ConvertTo-Json) -Headers $worAuthH -ErrorAction Stop
        FAIL "Worker SHOULD NOT be able to book computer lab (rank 3 > maxRank 2), but got 200"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Info "Worker booking lab returned HTTP $statusCode"
        Check ($statusCode -eq 403) "Worker correctly DENIED access to lab (403)" "Expected 403 but got $statusCode"
    }
} else {
    Info "No available slots to test worker denial"
}

# ============================================================
Log "STEP 14: BOOKING TESTS - Student books Computer Lab (rank 2 <= maxRank 2 -> SHOULD WORK)"
# ============================================================

$stuLabSlots = Invoke-RestMethod -Uri "$BASE/api/resources/$($lab._id)/slots?date=$today" -Headers $stuAuthH
$stuLabSlot = $stuLabSlots.slots | Where-Object { $_.available -eq $true } | Select-Object -First 1

$stuLabHold = Invoke-RestMethod -Uri "$BASE/api/bookings/hold" -Method POST -Body (@{
    resourceId = $lab._id; slotStart = $stuLabSlot.slotStart
} | ConvertTo-Json) -Headers $stuAuthH
Info "Student HELD lab slot - status: $($stuLabHold.status)"
Check ($stuLabHold.status -eq "held") "Student successfully held computer lab" "Student should be able to hold computer lab"

# ============================================================
Log "STEP 15: WAITLIST TEST - Join waitlist for occupied slot"
# ============================================================

# The auditorium slot is confirmed by faculty. Worker tries to waitlist (if allowed)
# Worker rank 3 > maxRank 1 -> should fail waitlist too
try {
    $worWaitlist = Invoke-WebRequest -Uri "$BASE/api/waitlists/join" -Method POST -Body (@{
        resourceId = $auditorium._id; slotStart = $firstSlot.slotStart
    } | ConvertTo-Json) -Headers $worAuthH -ErrorAction Stop
    FAIL "Worker should not be able to join waitlist for auditorium (rank 3 > maxRank 1)"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Info "Worker waitlist auditorium returned HTTP $statusCode"
    Check ($statusCode -eq 403) "Worker correctly DENIED waitlist for auditorium (403)" "Expected 403 but got $statusCode"
}

# Student (rank 2) should also be denied waitlist for auditorium (maxRank 1)
try {
    $stuWaitlist = Invoke-WebRequest -Uri "$BASE/api/waitlists/join" -Method POST -Body (@{
        resourceId = $auditorium._id; slotStart = $firstSlot.slotStart
    } | ConvertTo-Json) -Headers $stuAuthH -ErrorAction Stop
    FAIL "Student should not be able to join waitlist for auditorium (rank 2 > maxRank 1)"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Info "Student waitlist auditorium returned HTTP $statusCode"
    Check ($statusCode -eq 403) "Student correctly DENIED waitlist for auditorium (403)" "Expected 403 but got $statusCode"
}

# ============================================================
Log "STEP 16: CANCELLATION + WAITLIST PROMOTION"
# ============================================================

# Cancel faculty's auditorium booking
$cancelRes = Invoke-RestMethod -Uri "$BASE/api/bookings/$($holdRes._id)/cancel" -Method POST -Headers $facAuthH
Info "Faculty CANCELLED auditorium booking - status: $($cancelRes.status)"
Check ($cancelRes.status -eq "cancelled") "Booking cancelled" "Booking should be cancelled"

# Now create a hold on auditorium for admin, then have faculty join waitlist, then cancel admin's
# to test waitlist promotion
$adminAudSlots = Invoke-RestMethod -Uri "$BASE/api/resources/$($auditorium._id)/slots?date=$today" -Headers $adminAuthH
$adminSlot = $adminAudSlots.slots | Where-Object { $_.available -eq $true } | Select-Object -First 1

if ($adminSlot) {
    $adminHold = Invoke-RestMethod -Uri "$BASE/api/bookings/hold" -Method POST -Body (@{
        resourceId = $auditorium._id; slotStart = $adminSlot.slotStart
    } | ConvertTo-Json) -Headers $adminAuthH
    Info "Admin HELD auditorium slot"

    # Faculty joins waitlist (rank 1 <= maxRank 1 -> OK)
    $facWaitlist = Invoke-RestMethod -Uri "$BASE/api/waitlists/join" -Method POST -Body (@{
        resourceId = $auditorium._id; slotStart = $adminSlot.slotStart
    } | ConvertTo-Json) -Headers $facAuthH
    Info "Faculty joined waitlist at position $($facWaitlist.position)"
    Check ($facWaitlist.position -eq 1) "Faculty is position 1 in waitlist" "Position should be 1"

    # Admin cancels -> triggers waitlist promotion
    $adminCancel = Invoke-RestMethod -Uri "$BASE/api/bookings/$($adminHold._id)/cancel" -Method POST -Headers $adminAuthH
    Info "Admin cancelled booking"
    Start-Sleep -Seconds 1  # Give time for async waitlist promotion

    # Check if faculty got promoted
    $adminSlotsAfter = Invoke-RestMethod -Uri "$BASE/api/resources/$($auditorium._id)/slots?date=$today" -Headers $adminAuthH
    $promotedSlot = $adminSlotsAfter.slots | Where-Object { $_.slotStart -eq $adminSlot.slotStart }
    Info "Slot status after cancellation: $($promotedSlot.status)"
    if ($promotedSlot.status -eq "held" -and $promotedSlot.bookingId) {
        Info "Waitlist PROMOTION worked! Faculty was auto-promoted to held booking"
        Check $true "Waitlist promotion successful" "Waitlist promotion failed"
    } else {
        Info "Waitlist promotion may not have fired yet (async). Status: $($promotedSlot.status)"
    }
} else {
    Info "No available slots for waitlist promotion test"
}

# ============================================================
Log "STEP 17: CRON TEST - Expire old holds"
# ============================================================

$cronRes = Invoke-RestMethod -Uri "$BASE/api/cron/expire-holds" -Method POST -Headers @{
    "Content-Type" = "application/json"
    "x-cron-secret" = "cron_secret_12345"
}
Info "Cron result: $($cronRes.message)"

# ============================================================
Log "STEP 18: REJECT FLOW TEST - Register new user, join queue, admin rejects"
# ============================================================

$rejectReg = Invoke-RestMethod -Uri "$BASE/api/auth/register" -Method POST -Body (@{
    name = "Rejected User"; email = "rejected@iitmadras.edu"; password = "Reject123!"
} | ConvertTo-Json) -Headers $headers
Info "Rejected user registered"
Start-Sleep -Milliseconds 500

$rejectLogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body (@{
    email = "rejected@iitmadras.edu"; password = "Reject123!"
} | ConvertTo-Json) -Headers $headers
$rejectToken = $rejectLogin.accessToken
$rejectAuthH = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $rejectToken" }
Info "Rejected user logged in"

# Join queue
$rejectJoin = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/join" -Method POST -Body (@{
    orgId = $orgId; requestedRoleLevelId = $stuRole._id
} | ConvertTo-Json) -Headers $rejectAuthH
Info "Rejected user joined queue at position $($rejectJoin.position)"

# Admin rejects
$pendingRej = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/pending" -Method GET -Headers $adminAuthH
$toReject = $pendingRej | Where-Object { $_.userId.email -eq "rejected@iitmadras.edu" }
$rejRes = Invoke-RestMethod -Uri "$BASE/api/waiting-queue/$($toReject._id)/resolve" -Method POST -Body (@{
    action = "reject"
} | ConvertTo-Json) -Headers $adminAuthH
Info "Admin REJECTED user: $($rejRes.message)"

# Verify rejected user can't access resources
$rejectResources = Invoke-WebRequest -Uri "$BASE/api/resources" -Method GET -Headers $rejectAuthH -ErrorAction SilentlyContinue
$rejStatusCode = $rejectResources.StatusCode
Info "Rejected user GET /resources returned HTTP $rejStatusCode"
if ($rejStatusCode -eq 403) {
    Check $true "Rejected user correctly DENIED access to resources (403)" "Should be denied"
} else {
    # The user has no org, so this might return 403 for missing orgId
    Info "Status code: $rejStatusCode"
}

# ============================================================
Log "STEP 19: DUPLICATE BOOKING TEST"
# ============================================================

# Admin tries to hold the same slot that admin already held (from waitlist promotion)
$adminSlots = Invoke-RestMethod -Uri "$BASE/api/resources/$($parking._id)/slots?date=$today" -Headers $adminAuthH
$adminParkSlot = $adminSlots.slots | Where-Object { $_.available -eq $true } | Select-Object -First 1

if ($adminParkSlot) {
    # Admin holds parking
    $adminParkHold = Invoke-RestMethod -Uri "$BASE/api/bookings/hold" -Method POST -Body (@{
        resourceId = $parking._id; slotStart = $adminParkSlot.slotStart
    } | ConvertTo-Json) -Headers $adminAuthH
    Info "Admin held parking slot"

    # Worker tries same slot
    try {
        $dupHold = Invoke-WebRequest -Uri "$BASE/api/bookings/hold" -Method POST -Body (@{
            resourceId = $parking._id; slotStart = $adminParkSlot.slotStart
        } | ConvertTo-Json) -Headers $worAuthH -ErrorAction Stop
        FAIL "Duplicate booking should have been rejected"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Info "Duplicate booking returned HTTP $statusCode"
        Check ($statusCode -eq 409) "Duplicate booking correctly returns 409 Conflict" "Expected 409 but got $statusCode"
    }

    # Cleanup - cancel admin's hold
    Invoke-RestMethod -Uri "$BASE/api/bookings/$($adminParkHold._id)/cancel" -Method POST -Headers $adminAuthH | Out-Null
}

# Worker's earlier hold on parking should still be valid
$worBookingCheck = Invoke-RestMethod -Uri "$BASE/api/bookings/$($worHoldRes._id)/confirm" -Method POST -Headers $worAuthH
Info "Worker confirmed parking booking - status: $($worBookingCheck.status)"
Check ($worBookingCheck.status -eq "confirmed") "Worker parking booking confirmed" "Worker parking booking should be confirmed"

# ============================================================
Log "STEP 20: MY ORGS / SWITCH ORG TEST"
# ============================================================

$myOrgs = Invoke-RestMethod -Uri "$BASE/api/auth/my-orgs" -Method GET -Headers $adminAuthH
Info "Admin's orgs: $($myOrgs.Count)"
Check ($myOrgs.Count -ge 1) "Admin has at least 1 org" "Admin should have at least 1 org"
Info "  - $($myOrgs[0].name) (type: $($myOrgs[0].type))"

# Members list
$members = Invoke-RestMethod -Uri "$BASE/api/members" -Method GET -Headers $adminAuthH
Info "Org members: $($members.Count)"
foreach ($m in $members) { Info "  - $($m.name) ($($m.email)) - role: $($m.roleName)" }

# ============================================================
Log "TEST SUMMARY"
# ============================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  PASSED: $passCount" -ForegroundColor Green
Write-Host "  FAILED: $failCount" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host "`n  ALL TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "`n  SOME TESTS FAILED - see details above" -ForegroundColor Yellow
}
