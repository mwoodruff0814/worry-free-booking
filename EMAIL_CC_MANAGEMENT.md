# Email CC Management Guide

## Overview

All booking notification emails can now CC multiple recipients. This makes it easy to keep everyone on your team informed about new bookings, cancellations, and updates.

---

## 🎯 How It Works

When a booking email is sent (confirmations, reminders, cancellations, etc.), the system automatically CC's everyone in your configured list.

**Current CC List:**
- matt@worryfreemovers.com
- zlarimer24@gmail.com

---

## ✏️ How to Add/Remove People

### Method 1: Edit .env File (Quick & Easy)

1. Open the file: `C:\Users\caspe\OneDrive\Desktop\worry-free-booking\.env`

2. Find the line that says:
   ```
   EMAIL_CC_LIST=matt@worryfreemovers.com,zlarimer24@gmail.com
   ```

3. Add or remove emails (comma-separated, NO spaces):
   ```
   # Example: Add john@worryfreemovers.com
   EMAIL_CC_LIST=matt@worryfreemovers.com,zlarimer24@gmail.com,john@worryfreemovers.com

   # Example: Remove zlarimer24@gmail.com
   EMAIL_CC_LIST=matt@worryfreemovers.com

   # Example: Just one person
   EMAIL_CC_LIST=matt@worryfreemovers.com

   # Example: Leave empty (no CCs)
   EMAIL_CC_LIST=
   ```

4. Save the file

5. Restart the server:
   ```bash
   # Stop the server (Ctrl+C in the terminal)
   # Then restart:
   npm start
   ```

---

## 📧 Which Emails Get CCed?

The CC list receives copies of:
- ✅ Booking confirmations (to customers)
- ✅ Company notifications (internal)
- ✅ 24-hour reminders
- ✅ Cancellation notifications
- ✅ Crew time-off requests
- ✅ All booking-related emails

---

## 🔐 Email Privacy

- Customers see: `To: customer@email.com`
- Team members see: `CC: matt@worryfreemovers.com, zlarimer24@gmail.com`
- CCed emails are visible to all recipients
- To hide recipients from each other, use BCC instead (would require code change)

---

## 💡 Common Scenarios

### Add a New Team Member
```env
# Before
EMAIL_CC_LIST=matt@worryfreemovers.com,zlarimer24@gmail.com

# After - add sarah@worryfreemovers.com
EMAIL_CC_LIST=matt@worryfreemovers.com,zlarimer24@gmail.com,sarah@worryfreemovers.com
```

### Remove Someone Who Left
```env
# Before
EMAIL_CC_LIST=matt@worryfreemovers.com,zlarimer24@gmail.com,john@example.com

# After - remove john
EMAIL_CC_LIST=matt@worryfreemovers.com,zlarimer24@gmail.com
```

### Temporarily Disable CCs (Vacation Mode)
```env
# Just leave it empty
EMAIL_CC_LIST=
```

### Use Personal Gmail for Notifications
```env
# You can use any email address
EMAIL_CC_LIST=matt@worryfreemovers.com,matt.personal@gmail.com
```

---

## 🚀 Future Enhancement: Admin Portal UI

In the future, we can add a "Settings" page to the admin portal where you can:
- Add/remove CC emails via web UI
- Test email delivery
- Set different CC lists for different email types
- Schedule CC lists (e.g., only CC certain people during business hours)

---

## 🆘 Troubleshooting

### CC emails not being sent

1. **Check .env syntax:**
   - No spaces between emails
   - Use commas to separate
   - No quotes around emails

   ```env
   # ✅ CORRECT
   EMAIL_CC_LIST=matt@worryfreemovers.com,zlarimer24@gmail.com

   # ❌ WRONG (has spaces)
   EMAIL_CC_LIST=matt@worryfreemovers.com, zlarimer24@gmail.com

   # ❌ WRONG (has quotes)
   EMAIL_CC_LIST="matt@worryfreemovers.com,zlarimer24@gmail.com"
   ```

2. **Restart the server** after making changes

3. **Check server logs** for email errors

### Someone not receiving CCs

1. Verify their email is in the `EMAIL_CC_LIST`
2. Check their spam/junk folder
3. Verify email address is spelled correctly
4. Test by creating a booking and checking if they receive it

### Too many people getting CCed

Simply edit `.env` and remove unwanted emails from the list, then restart the server.

---

## 📝 Example .env Configuration

```env
# ================================================
# Email Configuration
# ================================================
EMAIL_SERVICE=gmail
EMAIL_USER=matt@worryfreemovers.com
EMAIL_PASSWORD=your_app_password

# Company Email (receives booking notifications)
COMPANY_EMAIL=service@worryfreemovers.com

# Email CC List (comma-separated, easy to add/remove people)
# Add or remove emails here - they'll be CCed on all booking notifications
EMAIL_CC_LIST=matt@worryfreemovers.com,zlarimer24@gmail.com
```

---

## ✅ Quick Reference

| Action | Command |
|--------|---------|
| Add email to CC list | Edit `.env` → Add email to `EMAIL_CC_LIST` → Restart server |
| Remove email from CC list | Edit `.env` → Remove email from `EMAIL_CC_LIST` → Restart server |
| Disable all CCs | Edit `.env` → Set `EMAIL_CC_LIST=` (empty) → Restart server |
| Test CC delivery | Create a test booking and verify CC recipients receive it |
| Check who's CCed | Open `.env` and look at `EMAIL_CC_LIST` value |

---

## 🎯 Summary

- **bwdrff1990@gmail.com** has been removed ✅
- **Easy to manage**: Just edit one line in `.env`
- **No hardcoding**: All emails controlled by configuration
- **Flexible**: Add/remove people anytime
- **Transparent**: Everyone sees who else is CCed

Need to add someone to the CC list? Just edit `.env` and restart the server. It's that simple!
