# Customization Guide - Worry Free Moving & Quality Moving

## 📧 1. Email Customization for Quality Moving

### Location
**File:** `services/emailService.js`

### What Needs Updating
Currently ALL emails say "Worry Free Moving" regardless of which company the booking is for.

### How to Fix
Update each email function to read company settings from `data/communication-settings.json`:

```javascript
// At the top of each email function, load company settings:
const fs = require('fs').promises;
const COMMUNICATION_SETTINGS_FILE = path.join(__dirname, '../data/communication-settings.json');

// In each function, determine company and load settings:
const company = details.company || 'Worry Free Moving';
const companySettings = await loadCompanySettings(company);

// Use company-specific settings:
from: `"${companySettings.companyName}" <${companySettings.companyEmail}>`,
subject: `✅ Booking Confirmed - ${companySettings.companyName}`,
// Replace "Worry Free Moving" text with ${companySettings.companyName}
// Replace phone numbers with ${companySettings.companyPhone}
// Replace email addresses with ${companySettings.companyEmail}
```

### Email Templates to Update
1. `sendConfirmationEmail` (lines 54-293)
2. `sendCancellationEmail` (lines 298-332)
3. `sendRescheduleEmail` (lines 348-425)
4. `sendCompanyNotification` (lines 430-472)
5. `send24HourReminder` (lines 477-521)

---

## 📱 2. SMS Customization for Quality Moving

### Location
**File:** `services/smsService.js`

### What Needs Updating
SMS messages need to use company-specific phone numbers and names.

### How to Fix
- Read from `data/communication-settings.json`
- Use `companySettings.smsFromNumber` and `companySettings.smsFromName`
- Update SMS text to include correct company name

---

## 📅 3. Calendar Integration Company-Specific Formatting

### Location
**File:** `server.js` - Lines 199-220 (calendar event creation)

### Current Format
```javascript
summary: `[${bookingCompany === 'Quality Moving' ? 'QM' : 'WF'}] ${serviceType} - ${firstName} ${lastName}`,
```

### Customization Options

You can customize:
1. **Event Titles** - Add more company branding
2. **Colors** - Different colors per company
3. **Description Format** - Include company-specific details
4. **Event Duration** - Company-specific default durations

### Example Custom Colors
```javascript
// Add to calendar event creation:
const companyColors = {
    'Worry Free Moving': '9', // Blue
    'Quality Moving': '10'     // Green
};

const eventDetails = {
    summary: `[${prefix}] ${serviceType} - ${firstName} ${lastName}`,
    colorId: companyColors[bookingCompany],
    // ... rest of event details
};
```

---

## 👤 4. Employee Portal System

### What Was Created
- **Employee Data:** `data/employees.json`
- **Employee Portal:** `employee-portal.html`
- **Features:**
  - Login with username/password
  - View personal profile
  - See time-off request status
  - Change password

### Current Employees
1. **Darrel** (Crew A Lead)
   - Username: `darrel`
   - Email: darrel@worryfreemovers.com
   - Team: Crew A

2. **Zach Larimer** (Crew B Lead)
   - Username: `zlarimer`
   - Email: zlarimer24@gmail.com
   - Phone: 330-261-7687
   - Team: Crew B

### Setting Employee Passwords

Employee passwords are currently placeholder hashes. To set real passwords:

1. Install bcrypt (already in package.json):
   ```
   npm install bcrypt
   ```

2. Generate password hash:
   ```javascript
   const bcrypt = require('bcrypt');
   const password = 'employee_password';
   const hash = await bcrypt.hash(password, 10);
   // Copy hash to employees.json
   ```

3. Or use the admin portal to set employee passwords (API needs to be added to server.js)

### Access URLs
- **Employee Portal:** http://localhost:3001/employee-portal.html
- **Time-Off Requests:** http://localhost:3001/crew-timeoff.html

### Employee Portal Features
- ✅ Login authentication
- ✅ View personal profile (name, email, phone, team, hire date)
- ✅ View time-off request status (pending, approved, denied)
- ✅ Submit new time-off requests (links to crew-timeoff.html)
- ✅ Change password
- ✅ Logout

### Employee Permissions
Employees can:
- View their own profile
- Submit time-off requests
- View their time-off request status
- Change their password

Employees CANNOT:
- View bookings
- Access admin portal
- See other employees' data
- Approve/deny time-off requests

---

## 🔐 5. Adding New Employees

### Step 1: Generate Password Hash
```javascript
const bcrypt = require('bcrypt');
const password = 'new_employee_password';
const hash = await bcrypt.hash(password, 10);
console.log(hash);
```

### Step 2: Add to employees.json
```json
{
  "id": "emp-firstname",
  "username": "username",
  "password": "$2b$10$hashed_password_here",
  "firstName": "First",
  "lastName": "Last",
  "email": "employee@worryfreemovers.com",
  "phone": "330-xxx-xxxx",
  "role": "crew",
  "team": "crew-a",
  "hireDate": "2025-01-01",
  "status": "active",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "lastLogin": null
}
```

### Step 3: Employee Can Now Login
- URL: http://localhost:3001/employee-portal.html
- Username: (from employees.json)
- Password: (the password you hashed)

---

## 📋 6. API Endpoints Needed (TO BE ADDED TO server.js)

### Employee Login
```javascript
POST /api/employee/login
Body: { username, password }
Returns: { success, token, employee }
```

### Get Employee Time-Off Requests
```javascript
GET /api/employee/timeoff-requests?email=employee@email.com
Returns: { success, requests: [...] }
```

### Change Employee Password
```javascript
POST /api/employee/change-password
Body: { employeeId, currentPassword, newPassword }
Returns: { success }
```

---

## 🏢 7. Quality Moving Settings Page

### Location
**File:** `quality-moving-settings.html`

### Access
- URL: http://localhost:3001/quality-moving-settings.html
- From Admin Portal: Click "Settings" tab → "Quality Moving Settings" button

### What It Controls
The Quality Moving Settings page is a centralized interface for all Quality Moving configurations:

1. **Company Information**
   - Company Name, Email, Phone
   - CC email recipients for notifications

2. **SMS Settings**
   - SMS from number and display name
   - SMS message templates

3. **Pricing Settings**
   - Hourly rate ($115/hour)
   - Minimum hours (2)
   - Additional fees notes

4. **Calendar Settings**
   - Event prefix (QM)
   - Event color (green)
   - Default event duration

5. **Email Template Settings**
   - Email signature
   - Subject line templates

6. **Service Offerings**
   - List of services provided
   - Service restrictions

7. **Payment & MovingHelp**
   - Note about prepaid customers through MovingHelp.com
   - Additional fees handled directly with customer on-site
   - No payment processing through the system

### Important Notes
- **All changes are saved to:** `data/communication-settings.json`
- **Customers are prepaid through MovingHelp:** No payment processing is needed through this booking system
- **Additional fees:** Any extra charges beyond the base rate are handled directly with customers on-site

---

## 🎨 8. Quick Customization Checklist

### For Quality Moving Branding:
- [✅] Quality Moving settings page created (`quality-moving-settings.html`)
- [✅] Settings page connected to admin portal
- [ ] Update `services/emailService.js` - Use communication-settings.json
- [ ] Update `services/smsService.js` - Use company-specific SMS settings
- [ ] Update calendar colors in `server.js` (optional)
- [ ] Test Quality Moving booking to verify emails/SMS use correct branding

### For Employee Portal:
- [✅] Employee data file created (`data/employees.json`)
- [✅] Employee portal created (`employee-portal.html`)
- [✅] API endpoints added to `server.js` (employee login, timeoff requests, password change)
- [ ] Set real passwords for Darrel and Zach
- [ ] Give employees their usernames and initial passwords
- Employees can access: http://localhost:3001/employee-portal.html
- Employees can request time-off: http://localhost:3001/crew-timeoff.html

---

## 📞 Support

For technical questions about customization:
- Review this guide
- Check individual file comments
- All settings files are in `data/` directory
- All email templates are in `services/emailService.js`

