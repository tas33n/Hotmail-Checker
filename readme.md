# Hotmail Checker (Not work's Anymore)

# use this one instead [ElectroPuppy](https://github.com/tas33n/ElectroPuppy-Hotmail-Checker)

This project is a Node.js script that authenticates email accounts and filters them based on specific criteria such as Netflix, PayPal, Facebook, Instagram, and Twitter emails. The results are logged into `live.txt` and `dead.txt` files.

## Features

- **Email Authentication**: Verifies email credentials using SMTP.
- **Email Filtering**: Filters emails based on the presence of specific service emails (Netflix, PayPal, Facebook, Instagram, Twitter).
- **Logging**: Logs the results into `live.txt` and `dead.txt` with timestamps and filter status.

## Installation

1. **Clone the repository**:
    ```sh
    git clone https://github.com/tas33n/hotmail-checker.git
    cd Hotmail-Checker
    ```

2. **Install dependencies**:
    ```sh
    npm install
    ```

## Usage

1. **Prepare your email list**:
    - Create a file named `mails.txt` in the root directory.
    - Add your email credentials in the format `email:password` (one per line).

2. **Configure Filters**:
    - Open `index.js`.
    - Set the boolean values for the filters you want to enable/disable:
        ```javascript
        const enableNetflixFilter = true;  // Set to false to disable
        const enablePayPalFilter = true;   // Set to false to disable
        const enableFacebookFilter = true; // Set to false to disable
        const enableInstagramFilter = true;// Set to false to disable
        const enableTwitterFilter = true;  // Set to false to disable
        ```

3. **Run the script**:
    ```sh
    node index.js
    ```

## Output

- **live.txt**: Contains authenticated emails with filter status.
- **dead.txt**: Contains emails that failed authentication.

## Example Output
Date: 10/10/2023, 10:00:00 AM
File: mails.txt
Number of lines: 5

Filters - Netflix: ✅ON, PayPal: ✅ON, Facebook: ✅ON, Instagram: ✅ON, Twitter: ✅ON

✅ 💨 email1@example.com:password1
Filtered: email1@example.com:password1 | Netflix: ✅ | PayPal: ❌ | Facebook: ✅ | Instagram: ❌ | Twitter: ❌

❌ 💨 email2@example.com:password2


## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/fooBar`).
3. Commit your changes (`git commit -am 'Add some fooBar'`).
4. Push to the branch (`git push origin feature/fooBar`).
5. Create a new Pull Request.

## Contact

For any inquiries, please contact [Telegram](https://t.me/lamb3rt).

---

*Happy Coding!* 🚀
