# LostAndFound: Smart Item Recovery Platform (Website)

> 🏆 Final Year Project at Atish Dipankar University of Science & Technology (ADUST). **Placed 2nd at the project defense.**

This is the **web version** of LostAndFound, a platform that helps people report lost items, post found items, and return them to their real owners. The website shares the same **Firebase backend** as the [Android app](https://github.com/munny1234-web/LostAndFound-app), so posts, claims and chats stay in sync across both platforms in real time.

## ✨ Features

- **Report lost or found items** with up to 4 photos (compressed in the browser)
- **Browse items** by category, with lost / found / resolved status
- **Map view** of where items were lost or found, with address search and reverse geocoding
- **Photo Search** to find matching items using a picture
- **Ownership claims with AI fraud check:** the claimant's answer is compared with the item's hidden detail using a Hugging Face sentence-similarity model, with a local fallback if the model is unavailable
- **Real-time chat** between the finder and the owner, with unread badges
- **In-app notifications** for claims, messages and updates
- **User profiles:** my posts, my claims, edit profile
- **Admin panel:** manage users and posts, review claims, and view analytics

## 🛠️ Tech Stack

| Part | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Firebase Authentication, Firebase Realtime Database |
| AI | Hugging Face Inference API (all-MiniLM-L6-v2 sentence similarity) |
| Maps | Leaflet, CARTO / Esri tiles, OpenStreetMap Nominatim |

## 📸 Screenshots

| Home | Item Details | Map | Admin |
|---|---|---|---|
| ![](screenshots/home.png) | ![](screenshots/item.png) | ![](screenshots/map.png) | ![](screenshots/admin.png) |

## ⚙️ How to Run

1. Clone this repository.
2. Copy `js/secrets.example.js` to `js/secrets.js` and paste your Hugging Face token (optional; without it the fraud check uses a local estimate).
3. Open `index.html` in a browser, or serve the folder with any local server.

> `js/secrets.js` is in `.gitignore`, so the real token is never uploaded.

## 🔗 Related

- Android app: [LostAndFound-app](https://github.com/munny1234-web/LostAndFound-app)

## 👩‍💻 Author

**Jannatul Ferdous Munny**
Supervised by **Mahmudur Rahman Roni**, Associate Professor, Department of CSE, ADUST

[LinkedIn](https://www.linkedin.com/in/jannatul-ferdous-munny-036028226) · ferdousmunny188@gmail.com
