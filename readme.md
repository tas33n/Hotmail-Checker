# ⚠️ Hotmail Checker (No Longer Works) ⚠️

## 📢 Use the Successor: [ElectroPuppy](https://github.com/tas33n/ElectroPuppy-Hotmail-Checker)

This project is **deprecated** and no longer functional due to changes in email authentication systems. We highly recommend using [ElectroPuppy](https://github.com/tas33n/ElectroPuppy-Hotmail-Checker), which provides **enhanced features, better stability, and up-to-date email filtering capabilities**.

---

## 🔹 About This Project

This was a Node.js-based script designed for email authentication and filtering, primarily for services like Netflix, PayPal, Facebook, Instagram, and Twitter. The tool categorized accounts as either **live** or **dead** and logged the results into separate files.

## 🚀 Features (Now Obsolete)

- ✅ **Email Authentication**: Verified credentials using SMTP.
- ✅ **Email Filtering**: Detected emails from key services (Netflix, PayPal, etc.).
- ✅ **Logging**: Stored results in `live.txt` and `dead.txt`.

## ⚡ Installation (No Longer Functional)

```sh
git clone https://github.com/tas33n/hotmail-checker.git
cd Hotmail-Checker
npm install
```

## 🔧 Configuration (Previously Used)

1. **Prepare Email List:**

   - Create a `mails.txt` file with email credentials (`email:password`).

2. **Modify Filters in **``**:**

   ```javascript
   const enableNetflixFilter = true;
   const enablePayPalFilter = true;
   const enableFacebookFilter = true;
   const enableInstagramFilter = true;
   const enableTwitterFilter = true;
   ```

3. **Run the Script (No Longer Works)**

   ```sh
   node index.js
   ```

## 📄 Output (Historical Reference)

- ``: Verified emails with filtering status.
- ``: Emails that failed authentication.

## 📌 Example Output

```
Date: 10/10/2023, 10:00:00 AM
File: mails.txt
Number of lines: 5

Filters - Netflix: ✅ON, PayPal: ✅ON, Facebook: ✅ON, Instagram: ✅ON, Twitter: ✅ON

✅ 💨 email1@example.com:password1 | Netflix: ✅ | PayPal: ❌ | Facebook: ✅
❌ 💨 email2@example.com:password2
```

---

## 🔄 Alternative: ElectroPuppy

For a **fully functional, modern replacement**, switch to **ElectroPuppy**, which includes: ✅ **Latest authentication techniques** ✅ **Improved filtering & logging** ✅ **Better stability & performance**

🔗 [**Get ElectroPuppy Here**](https://github.com/tas33n/ElectroPuppy-Hotmail-Checker)

---

## 🛠️ Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/new-feature`).
3. Commit changes (`git commit -am 'Add new feature'`).
4. Push the branch (`git push origin feature/new-feature`).
5. Submit a Pull Request.

## 📞 Contact

For any inquiries, reach out via [**Telegram**](https://t.me/lamb3rt).

---

🚀 **Thank you for your support!**

