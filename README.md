# 🌟 TaskQuest - Family Task Management App

Welcome to **TaskQuest**, a gamified task management system designed for families! Children earn points by completing real-life tasks with photo verification, and parents approve submissions and manage rewards.

## ✨ Features

### 🔐 **Authentication & Security**
- Separate login flows for parents and children
- 6-digit passcode protection for parent dashboard
- Family code system to connect parents with children
- Firebase Authentication integration

### 👨‍👩‍👧‍👦 **Family Connection System**
- **Parent signup**: Automatically generates a unique 6-digit Family Code
- **Child signup**: Children enter their parent's Family Code to join the family
- **Isolated families**: Each family's data is completely separate and secure
- **Real-time sync**: Tasks and rewards created by parents instantly appear for all children in the family

### 📋 **Parent Dashboard**
- **Pending Verifications**: Review children's task submissions with before/after photos
- **Approve or Decline**: Award points for approved tasks
- **Children Profiles**: View each child's points, completed tasks, and pending submissions
- **Add Bonus Points**: Reward children with extra points manually
- **Reset Points**: Clear a child's points if needed
- **Task Templates**: Create reusable tasks with custom points, descriptions, and icons
- **Rewards Management**: Define rewards with point costs
- **Settings**: Change passcode and view/copy Family Code

### 👦 **Child Dashboard**
- **Points Display**: Large, animated display of current points
- **Available Tasks**: Browse all tasks created by parents
- **Photo Upload**: Submit before and after photos for task completion
- **Rewards Store**: View and redeem rewards with earned points
- **Activity History**: Track completed tasks, pending submissions, and redeemed rewards
- **Profile Stats**: View total points earned, tasks completed, and rewards redeemed

### 📸 **Task Verification System**
- Two-step photo upload (before and after)
- Firebase Storage integration for image hosting
- Preview images before submission
- Parent review with side-by-side photo comparison

### 🎁 **Rewards System**
- Children can redeem points for parent-defined rewards
- Locked/unlocked states based on available points
- Reward redemption history tracking

### 📊 **Analytics & Tracking**
- Activity history with timestamps
- Submission status tracking (approved, pending, declined)
- Points earned and spent history
- Completion statistics

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Firebase account (for backend services)

### Installation

1. **Download the project files**
   - All HTML, CSS, and JavaScript files are included
   - No build process required - pure HTML/CSS/JS

2. **Set up Firebase**
   - Follow the instructions in `FIREBASE_SETUP.md`
   - Apply the Firestore Security Rules
   - Apply the Storage Rules

3. **Update Firebase Configuration**
   - Open `scripts/main.js`
   - Replace the `firebaseConfig` object with your Firebase project credentials

4. **Deploy**
   - Upload all files to a web server or hosting platform
   - Or run locally with a simple HTTP server

### Quick Start
\`\`\`bash
# Run locally with Python
python -m http.server 8000

# Or with Node.js
npx http-server
\`\`\`

Then open `http://localhost:8000` in your browser.

## 📁 Project Structure

\`\`\`
taskquest/
│
├── index.html                 # Login page
├── parent-dashboard.html      # Parent dashboard
├── child-dashboard.html       # Child dashboard
│
├── styles/
│   └── main.css              # All styles
│
├── scripts/
│   └── main.js               # All JavaScript logic
│
├── assets/                   # Optional: Add icons/images
│
├── FIREBASE_SETUP.md         # Firebase configuration guide
├── README.md                 # This file
└── package.json              # Project metadata
\`\`\`

## 🎮 How to Use

### For Parents:

1. **Sign Up**
   - Click "Parent Login"
   - Click "Sign up" to create an account
   - Create a 6-digit passcode for additional security
   - Receive your unique Family Code

2. **Share Family Code**
   - Go to Settings tab in your dashboard
   - Copy your Family Code
   - Share it with your children

3. **Create Tasks**
   - Go to Tasks tab
   - Click "Create New Task"
   - Add title, description, points, and optional icon
   - Task instantly appears for all children

4. **Create Rewards**
   - Go to Rewards tab
   - Click "Add Reward"
   - Define reward name, cost, and optional icon

5. **Review Submissions**
   - Go to Approvals tab
   - View before/after photos
   - Approve (child earns points) or Decline

6. **Manage Children**
   - Go to Children tab
   - View points and statistics
   - Add bonus points or reset points

### For Children:

1. **Sign Up**
   - Click "Child Login"
   - Click "Sign up" to create an account
   - Enter the Family Code from your parent
   - Create your account

2. **Complete Tasks**
   - Browse available tasks
   - Click "Start Task"
   - Upload before photo
   - Complete the task
   - Upload after photo
   - Submit for review

3. **Earn Points**
   - Wait for parent approval
   - Receive points when approved

4. **Redeem Rewards**
   - Go to Rewards tab
   - Browse available rewards
   - Click "Redeem" when you have enough points
   - Parent will be notified

5. **Track Progress**
   - Go to Profile tab
   - View your statistics and activity history

## 🔒 Security

- **Firebase Authentication**: Secure user accounts
- **Firestore Security Rules**: Data isolation per family
- **Passcode Protection**: Additional layer for parent dashboard
- **Family Code System**: Controlled child-parent linking

## 🎨 Design Features

- **Modern UI**: Clean, gradient-based design
- **Responsive**: Works on all devices (mobile, tablet, desktop)
- **Animations**: Smooth transitions and engaging interactions
- **Kid-Friendly**: Large buttons, emojis, and colorful interface
- **Parent-Friendly**: Professional, organized dashboard

## 🛠️ Technologies Used

- **HTML5**: Structure
- **CSS3**: Styling with custom properties and animations
- **JavaScript (ES6+)**: Logic and Firebase integration
- **Firebase**:
  - Authentication (user accounts)
  - Firestore (database)
  - Storage (photo uploads)

## 📝 Task Templates Ideas

Here are some suggested tasks to create:

### Home Chores
- 🧹 Clean your room
- 🗑️ Take out the trash
- 🧺 Do laundry
- 🍽️ Wash dishes
- 🧽 Mop floors
- 🪟 Clean windows

### Academic
- 📚 Complete homework
- 📖 Read for 30 minutes
- ✏️ Study for test
- 🧮 Practice math

### Personal Care
- 🛏️ Make your bed
- 🪥 Brush teeth
- 🚿 Take a shower
- 👕 Organize closet

### Helping Others
- 👶 Help siblings
- 🍳 Help cook dinner
- 🛒 Help with groceries
- 🐕 Walk the dog

### Creative
- 🎨 Complete an art project
- 🎵 Practice instrument
- ✍️ Write in journal

## 🎁 Reward Ideas

### Small Rewards (50-100 points)
- 🍫 Chocolate bar
- 🍦 Ice cream
- 🎮 30 min extra screen time
- 📺 Choose movie night film

### Medium Rewards (200-500 points)
- 🍕 Favorite takeout meal
- 🎪 Trip to the park
- 🎨 Art supplies
- 📚 New book

### Large Rewards (500+ points)
- 🎮 New video game
- 🧸 Special toy
- 🎉 Birthday party
- 💰 Real money ($5-$20)
- 🎢 Theme park visit

## 🐛 Troubleshooting

### Common Issues:

1. **Firebase Permission Errors**
   - Make sure you've applied the security rules from `FIREBASE_SETUP.md`
   - Check that your Firebase project is active

2. **Photos Not Uploading**
   - Check Storage rules are configured
   - Verify Firebase Storage is enabled in your project

3. **Tasks Not Showing**
   - Confirm child used correct Family Code during signup
   - Verify parent and child are in the same family

4. **Can't Login**
   - Check email and password are correct
   - Ensure you're using the correct login type (parent vs child)

## 📧 Support

For issues or questions:
1. Check `FIREBASE_SETUP.md` for Firebase configuration
2. Review browser console for error messages
3. Verify all Firebase services are enabled

## 🙏 Credits

Built with ❤️ for families who want to make chores fun and rewarding!

## 📄 License

This project is free to use for personal and educational purposes.

---

**Happy TaskQuesting! 🌟**