# Project Overview / نظرة عامة على المشروع

This document provides a detailed explanation of the **Admin Dashboard & Cancer Center Website** project.
هذا المستند يقدم شرحاً مفصلاً لمشروع لوحة تحكم الأدمن وموقع مركز السرطان.

---

## 🇬🇧 English Documentation

### 1. Introduction
This project is a complete web application consisting of a public-facing website for a "Comprehensive Cancer Center" and a secure Admin Dashboard. The system allows administrators to manage website content (text, images, visibility of sections) without editing code.

### 2. Architecture
The project uses a **Node.js** backend with **Express** and a JSON-based file storage system.

*   **Backend**: Node.js + Express.
*   **Database**: Local JSON files in the `data/` directory. No external database (SQL/MongoDB) is required, making it easy to deploy and backup.
*   **Frontend**:
    *   **Public Website**: Static HTML/CSS (TailwindCSS) served dynamically. It fetches content from the API to render text and images.
    *   **Admin Dashboard**: A protected area where admins can log in, edit content, and upload images.

### 3. Project Structure

| File/Folder | Description |
| :--- | :--- |
| `server.js` | The main heart of the application. It handles the web server, API endpoints, security, login logic, and file saving. |
| `data/` | **CRITICAL**. Stores all the data. <br> - `content.json`: The live content displayed on the website. <br> - `users.json`: Admin usernames and hashed passwords. <br> - `contacts.json`: Submissions from the "Contact Us" form. |
| `website/` | Contains the public-facing `index.html`. This is the layout of the main site. |
| `admin/` | Contains `login.html` and `dashboard.html`. These are the interfaces for the admin panel. |
| `uploads/` | Stores images uploaded via the admin dashboard. |
| `package.json` | Lists project dependencies (Express, Bcrypt, Multer, Tailwind, etc.). |

### 4. Key Features

#### Content Management (CMS)
*   **Dynamic Content**: The website isn't hardcoded. It pulls text/images from `data/content.json`.
*   **Drag-and-Drop**: The Admin Dashboard allows reordering website sections (Hero, Services, Team, etc.) using drag-and-drop.
*   **Visibility Toggle**: Admins can hide/show sections instantly.
*   **Image Uploads**: Admins can upload images which are saved to `uploads/`.

#### Security
*   **Authentication**: Secure login system. Passwords are **hashed** using `bcrypt` (never stored in plain text).
*   **Protection**:
    *   `Helmet`: Protects against HTTP header attacks.
    *   `Rate Limiting`: Prevents brute-force attacks on login and contact forms.
    *   `CSRF Protection`: Prevents Cross-Site Request Forgery attacks.
    *   `Session Management`: Secure cookies for logged-in admins.

#### API Endpoints
*   `GET /api/public/content`: Fetches content for the public website.
*   `POST /api/contacts`: Handles contact form submissions.
*   `POST /login`: Handles admin login.
*   `GET /api/admin/content`: Fetches content for the admin editor (requires auth).
*   `POST /api/admin/content`: Saves content updates (requires auth).

### 5. How to Run

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Start the Server**:
    ```bash
    npm start
    ```
3.  **Access the App**:
    *   **Website**: http://localhost:3000/
    *   **Admin Login**: http://localhost:3000/login.html
    *   **Default Credentials**: Username: `admin`, Password: `admin123` (Change this in production!).

---

## 🇪🇬 شرح باللغة العربية (Arabic Explanation)

### ١. مقدمة
هذا المشروع عبارة عن تطبيق ويب متكامل يتكون من موقع إلكتروني عام لـ "مركز شامل لعلاج السرطان" ولوحة تحكم (Admin Dashboard) آمنة. يتيح النظام للمسؤولين إدارة محتوى الموقع (النصوص، الصور، ترتيب وتفعيل الأقسام) بسهولة دون الحاجة لتعديل الكود البرمجي.

### ٢. البنية التقنية (Architecture)
يعمل المشروع باستخدام **Node.js** مع إطار عمل **Express**، ويعتمد على ملفات JSON لتخزين البيانات.

*   **الخلفية (Backend)**: Node.js + Express.
*   **قاعدة البيانات**: ملفات JSON محلية داخل مجلد `data/`. لا يحتاج لقاعدة بيانات خارجية (مثل SQL أو MongoDB)، مما يسهل تشغيله وأخذ نسخ احتياطية منه.
*   **الواجهة الأمامية (Frontend)**:
    *   **الموقع العام**: HTML/CSS (بما في ذلك TailwindCSS). يقوم بجلب المحتوى من الـ API لعرضه.
    *   **لوحة التحكم**: منطقة محمية تتيح للمدير تسجيل الدخول وتعديل المحتوى.

### ٣. هيكل المشروع (Project Structure)

| الملف/المجلد | الوصف |
| :--- | :--- |
| `server.js` | الملف الرئيسي للتطبيق. يدير الخادم، الـ API، الحماية، تسجيل الدخول، وحفظ الملفات. |
| `data/` | **هام جداً**. يحتوي على جميع البيانات. <br> - `content.json`: المحتوى المعروض حالياً على الموقع. <br> - `users.json`: بيانات الدخول للمديرين (كلمات السر مشفرة). <br> - `contacts.json`: رسائل "اتصل بنا" المرسلة من الزوار. |
| `website/` | يحتوي على `index.html` الخاص بالموقع العام. |
| `admin/` | يحتوي على `login.html` و `dashboard.html` الخاصة بلوحة التحكم. |
| `uploads/` | مجلد لتخزين الصور التي يتم رفعها من لوحة التحكم. |
| `package.json` | ملف تعريف المشروع والمكتبات المستخدمة. |

### ٤. المميزات الرئيسية

#### إدارة المحتوى (CMS)
*   **محتوى ديناميكي**: النصوص والصور في الموقع ليست ثابتة، بل يتم جلبها من ملف البيانات.
*   **الترتيب بالسحب والإفلات**: يمكن للمدير إعادة ترتيب أقسام الموقع (مثل الخدمات، الفريق الطبي، إلخ) بسهولة.
*   **إخفاء/إظهار**: يمكن إخفاء أو إظهار أي قسم في الموقع بضغطة زر.
*   **رفع الصور**: إمكانية رفع صور جديدة وحفظها تلقائياً.

#### الأمان والحماية (Security)
*   **تسجيل الدخول**: نظام آمن. كلمات السر **مشفرة** (Hashed) باستخدام تقنية `bcrypt` فلا يمكن قرائتها حتى لو سرق الملف.
*   **الحماية من الهجمات**:
    *   تحديد عدد المحاولات (Rate Limiting) لمنع التخمين المستمر لكلمة السر.
    *   حماية ضد هجمات CSRF.
    *   استخدام `Helmet` لتأمين ترويسات HTTP.

### ٥. كيفية التشغيل

1.  **تثبيت المكتبات**:
    ```bash
    npm install
    ```
2.  **تشغيل الخادم**:
    ```bash
    npm start
    ```
3.  **الدخول للتطبيق**:
    *   **الموقع**: http://localhost:3000/
    *   **صفحة الدخول**: http://localhost:3000/login.html
    *   **بيانات الدخول الافتراضية**: اسم المستخدم: `admin`، كلمة السر: `admin123` (يجب تغييرها عند النشر!).
