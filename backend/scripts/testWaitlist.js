$BASE = "http://localhost:10000"

Write-Host "`n=== TEST: Slots + Waitlist Modal ===" -ForegroundColor Cyan

# Login as admin
$adminLogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body '{"email":"admin@iitmadras.edu","password":"Admin123!"}' -ContentType "application/json"
$adminH = @{ "Authorization" = "Bearer $($adminLogin.accessToken)"; "Content-Type" = "application/json" }
Write-Host "[1] Admin logged in (rank $($adminLogin.user.rank))"

# Get resources
$resources = Invoke-RestMethod -Uri "$BASE/api/resources" -Headers $adminH
$res = $resources | Where-Object { $_.name -eq "Main Auditorium" }
Write-Host "[2] Resource: $($res.name) (ID: $($res._id))"

# Get slots for today
$today = (Get-Date).ToString("yyyy-MM-dd")
$slots = Invoke-RestMethod -Uri "$BASE/api/resources/$($res._id)/slots?date=$today" -Headers $adminH
Write-Host "[3] Slots count: $($slots.slots.Count)"
Write-Host "    First slot: $($slots.slots[0].slotStart)"
Write-Host "    Last slot: $($slots.slots[-1].slotStart)"

# Check first slot starts at 05:00
$firstHour = [int]($slots.slots[0].slotStart.Substring(11,2))
Write-Host "    First slot hour (UTC): $firstHour"
if ($firstHour -eq 5) { Write-Host "    [PASS] Starts at 5 AM UTC" -ForegroundColor Green } else { Write-Host "    [FAIL] Expected hour 5, got $firstHour" -ForegroundColor Red }

# Hold first slot as admin
$holdSlot = $slots.slots[0].slotStart
$hold = Invoke-RestMethod -Uri "$BASE/api/bookings/hold" -Method POST -Body (@{ resourceId = $res._id; slotStart = $holdSlot } | ConvertTo-Json) -Headers $adminH
Write-Host "[4] Admin HELD slot: $holdSlot (booking: $($hold._id))"

# Login as faculty
$facLogin = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body '{"email":"ravi@iitmadras.edu","password":"Faculty123!"}' -ContentType "application/json"
$facH = @{ "Authorization" = "Bearer $($facLogin.accessToken)"; "Content-Type" = "application/json" }
Write-Host "[5] Faculty logged in (rank $($facLogin.user.rank))"

# Join waitlist for the same slot
try {
    $wl = Invoke-RestMethod -Uri "$BASE/api/waitlists/join" -Method POST -Body (@{ resourceId = $res._id; slotStart = $holdSlot } | ConvertTo-Json) -Headers $facH
    Write-Host "[6] Faculty JOINED waitlist at position $($wl.position)" -ForegroundColor Green
} catch {
    Write-Host "[6] Waitlist join FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Check slots again as admin - should show waitlistCount=1
$slots2 = Invoke-RestMethod -Uri "$BASE/api/resources/$($res._id)/slots?date=$today" -Headers $adminH
$targetSlot = $slots2.slots | Where-Object { $_.slotStart -eq $holdSlot }
Write-Host "[7] Slot waitlistCount: $($targetSlot.waitlistCount)"
Write-Host "    Slot userInWaitlist (admin): $($targetSlot.userInWaitlist)"
Write-Host "    Slot bookingUserId: $($targetSlot.bookingUserId)"
Write-Host "    Slot waitlistUsers: $($targetSlot.waitlistUsers | ConvertTo-Json -Compress)"

if ($targetSlot.waitlistCount -ge 1) { Write-Host "    [PASS] Waitlist count >= 1" -ForegroundColor Green } else { Write-Host "    [FAIL] Waitlist count should be >= 1" -ForegroundColor Red }

# Login as faculty and check slot
$slots3 = Invoke-RestMethod -Uri "$BASE/api/resources/$($res._id)/slots?date=$today" -Headers $facH
$targetSlot3 = $slots3.slots | Where-Object { $_.slotStart -eq $holdSlot }
Write-Host "[8] As faculty - userInWaitlist: $($targetSlot3.userInWaitlist)"
if ($targetSlot3.userInWaitlist -eq $true) { Write-Host "    [PASS] Faculty IS in waitlist" -ForegroundColor Green } else { Write-Host "    [FAIL] Faculty should be in waitlist" -ForegroundColor Red }

# Try joining again - should fail
try {
    $wl2 = Invoke-RestMethod -Uri "$BASE/api/waitlists/join" -Method POST -Body (@{ resourceId = $res._id; slotStart = $holdSlot } | ConvertTo-Json) -Headers $facH
    Write-Host "[9] [FAIL] Duplicate waitlist should have been rejected" -ForegroundColor Red
} catch {
    $err = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "[9] [PASS] Duplicate waitlist rejected: $($err.error)" -ForegroundColor Green
}

# Cleanup - cancel admin booking
Invoke-RestMethod -Uri "$BASE/api/bookings/$($hold._id)/cancel" -Method POST -Headers $adminH | Out-Null
Write-Host "[10] Cleaned up: cancelled admin booking"

Write-Host "`n=== ALL DONE ===" -ForegroundColor Cyan
