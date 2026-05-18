# Snipe-IT Lost & Found

A lightweight, serverless application designed to act as a public-facing "Lost and Found" portal for devices managed in [Snipe-IT](https://snipeitapp.com/). 

When a user scans an asset's QR code or visits the URL (e.g., `https://lost.yourdomain.com/ASSET-TAG`), this application fetches the asset data directly from the Snipe-IT API and displays a responsive, mobile-friendly information card.

Designed to be deployed for **free** on [Cloudflare Pages](https://pages.cloudflare.com/) using Edge Functions.

## Features

* **Serverless Architecture:** Runs entirely on Cloudflare Pages Functions. No Docker or server maintenance required.
* **Real-time API Proxy:** Safely proxies requests to the Snipe-IT API without exposing your API token to the public frontend.
* **Smart Contact Routing:** Automatically fetches contact information (Email/Phone) from the organization assigned to the asset.
* **"Lost" Status Detection:** Displays a prominent warning banner if the device is marked as "Lost" in Snipe-IT.
* **Custom Overrides via Notes:** Supports special keywords in the Snipe-IT asset or company notes:
  * `hidecontact`: Forces the contact section to be hidden.
  * `showcontact`: Forces the contact section to be shown (default is only showing if marked as "Lost").
  * `customcontact: Your custom text here`: Replaces the default contact info with your own specific message.

## Prerequisites

* A running Snipe-IT instance.
* A Snipe-IT API Token (generated in your Snipe-IT user profile).
* Node.js (v18+) for local development.

## Local Development

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yourusername/snipeit-lostnfound.git](https://github.com/yourusername/snipeit-lostnfound.git)
   cd snipeit-lostnfound

```

2. **Install dependencies:**
```bash
npm install

```


3. **Configure local environment variables:**
Create a file named `.dev.vars` in the root directory and add your Snipe-IT credentials:
```env
SNIPEIT_URL=[https://your-snipeit-instance.com](https://your-snipeit-instance.com)
SNIPEIT_TOKEN=your_personal_access_token

```


*(Note: Never commit this file. It is ignored by `.gitignore`.)*
4. **Start the local development server:**
```bash
npm run dev

```


Open `http://localhost:3000/YOUR-ASSET-TAG` in your browser to test.

## Deployment to Cloudflare Pages

Deployment is completely automated via Git integration.

1. Push this repository to GitHub or GitLab.
2. Log in to your Cloudflare Dashboard and navigate to **Workers & Pages**.
3. Click **Create** -> **Pages** -> **Connect to Git**.
4. Select your repository.
5. In the build settings:
* **Framework preset:** None
* **Build command:** *(leave empty)*
* **Build output directory:** `public` (or leave empty if you don't use static assets)


6. **Crucial Step:** Scroll down to **Environment variables (advanced)** and add:
* `SNIPEIT_URL` (e.g., `https://your-snipeit-instance.com`)
* `SNIPEIT_TOKEN` (your secret API token)


7. Click **Save and Deploy**.

Cloudflare will now automatically deploy your function. Whenever you push changes to your main branch, Cloudflare will update the live site within seconds.

## Disclaimer

**AI-Generated Code**
Please note that the code in this repository was generated and programmed with the assistance of Artificial Intelligence (AI). While the code has been tested for its intended functionality, it is highly recommended that you review and understand the code before deploying it to production environments.

## License

This project is licensed under the **MIT License**.
Commercial and private use, modification, and distribution are permitted. However, the original copyright notice and the permission notice must be included in all copies or substantial portions of the software (Attribution required). See the `LICENSE` file for full details.