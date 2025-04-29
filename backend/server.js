require('dotenv').config();
const express = require("express");
const mysql = require("mysql2/promise"); 
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");
const jwt = require('jsonwebtoken');
const app = express();
const cors = require("cors");

const path = require("path");
const crypto = require('crypto');
const nodemailer = require('nodemailer');


const JWT_SECRET = process.env.JWT_SECRET;

app.use(express.json());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));


const corsOptions = {
  origin: 'https://aptipro.netlify.app', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'], 
  credentials: true, 
};

app.use(cors(corsOptions));




const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000 
});


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
 tls: {
    rejectUnauthorized: false, 
  },
 logger: true, // Enable logging
  debug: true,
});


pool.getConnection()
    .then(conn => {
        console.log("Connected to MySQL database");
        conn.release();
    })
    .catch(err => {
        console.error("Database connection failed:", err);
        process.exit(1);
    });






const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err){console.log("Auth failed: Invalid token", err);return res.status(403).json({ error: "Invalid token" });}
     console.log("Authentication successful for user:", decoded.username);
req.user = decoded; 
    next();
  });
};





app.post("/signup", async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            "INSERT INTO users (email, username, password) VALUES (?, ?, ?)",
            [email, username, hashedPassword]
        );
        res.status(201).json({ message: "User registered successfully!" });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Email or username already exists." });
        }
        console.error("Signup error:", err);
        res.status(500).json({ message: "An unexpected error occurred." });
    }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
   
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) throw new Error("User not found");

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error("Invalid password");

    
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' } 
    );

   
    res.json({ 
      token, 
      user: { id: user.id, username: user.username, email: user.email } 
    });

  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});






app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'If this email exists, a reset link has been sent' 
      });
    }

    const user = users[0];

    
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    const [updateResult] = await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
      [resetToken, resetTokenExpiry, email]
    );

    console.log(`Password reset token set for ${email}`, updateResult);

   
const resetUrl = `https://aptipro.onrender.com/reset-password.html?token=${resetToken}`;
    
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Password Reset Request - AptiPro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a6baf;">Password Reset Request</h2>
          <p>Hello ${user.username},</p>
          <p>You requested a password reset for your AptiPro account.</p>
          <p>Please click the button below to reset your password:</p>
          <div style="margin: 25px 0;">
            <a href="${resetUrl}" style="background-color: #4a6baf; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #777;">For security reasons, please do not share this email with anyone.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: 'If this email exists, a reset link has been sent' 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing password reset request' 
    });
  }
});



app.get('/reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'reset-password.html')); // Adjust path if the file is elsewhere
});


app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }

    const user = users[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE email = ?',
      [hashedPassword, user.email]
    );

    res.json({ 
      success: true, 
      message: 'Password has been reset successfully' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error resetting password' 
    });
  }
});

app.get('/verify-reset-token', async (req, res) => {
  const { token } = req.query;

  try {
    const [users] = await pool.query(
      'SELECT email FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(200).json({ 
        valid: false,
        message: 'Invalid or expired token' 
      });
    }

    res.json({ 
      valid: true,
      message: 'Token is valid' 
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      valid: false,
      message: 'Error verifying token' 
    });
  }
});




app.get('/api/questions', async (req, res) => {
    let connection;
    try {
        const count = parseInt(req.query.count) || 60; 
        const topic = req.query.topic || 'profit';   

        console.log(`Fetching ${count} questions on topic: ${topic}`);
        
        connection = await pool.getConnection();
        
        // Get total questions count
        const [totalRows] = await connection.query(
            'SELECT COUNT(*) as total FROM quantitative_questions WHERE topic = ?',
            [topic]
        );
        const totalAvailable = totalRows[0].total;
        const actualCount = Math.min(count, totalAvailable);

        // Fetch questions
        const [questions] = await connection.query(
            `SELECT 
                id,
                question as text,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_answer,
                explanation,
                topic
             FROM quantitative_questions WHERE topic = ?
             ORDER BY RAND()
             LIMIT ?`,
            [topic, actualCount]
        );

        if (!questions || questions.length === 0) {
            connection.release();
            return res.status(404).json({
                success: false,
                error: "No questions available for this topic"
            });
        }

        const processedQuestions = questions.map(q => {
            const options = [
                q.option_a,
                q.option_b,
                q.option_c,
                q.option_d
            ].filter(opt => opt !== null && opt !== undefined);

            const correctIndex = options.findIndex(opt => opt === q.correct_answer);
            
            return {
                id: q.id,
                text: q.text,
                options: options,
                correctAnswer: correctIndex >= 0 ? correctIndex : 0,
                correct_answer: q.correct_answer, 
                explanation: q.explanation || 'No explanation available',
                topic: q.topic || 'Unknown', 
                difficulty: 'medium' 
            };
        });

        connection.release();
        
        res.json({
            success: true,
            questions: processedQuestions,
            totalAvailable: totalAvailable,
            requested: count,
            returned: processedQuestions.length
        });

    } catch (err) {
        if (connection) connection.release();
        
        console.error("Endpoint error:", {
            message: err.message,
            stack: err.stack,
            sql: err.sql
        });
        
        res.status(500).json({
            success: false,
            error: "Failed to process request",
            details: process.env.NODE_ENV === 'development' ? {
                message: err.message,
                sql: err.sql
            } : undefined
        });
    }
});


app.post('/api/save-test-result', authenticateJWT, async (req, res) => {
   console.log('Received topic:', req.body.topic);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User from JWT:', req.user);
    
    const {
        test_name,
        topic,
        score,
        total_questions,
        avg_time,
        detailed_results
    } = req.body;

    
    const validationErrors = [];
    
    if (!test_name) validationErrors.push("test_name is required");
    if (!topic) validationErrors.push("topic is required");
    if (typeof score !== 'number') validationErrors.push("score must be a number");
    if (typeof total_questions !== 'number') validationErrors.push("total_questions must be a number");
    if (typeof avg_time !== 'number') validationErrors.push("avg_time must be a number");
    if (!detailed_results) validationErrors.push("detailed_results are required");
    
    if (validationErrors.length > 0) {
        console.log('Validation errors:', validationErrors);
        return res.status(400).json({ 
            error: "Invalid input data", 
            details: validationErrors 
        });
    }

    let connection;
    try {
       
        const userId = req.user.id;
        console.log(`Processing test result for user ID: ${userId}`);
        
        connection = await pool.getConnection();
      
        const [users] = await connection.execute(
            'SELECT username, email FROM users WHERE id = ?', 
            [userId]
        );

        if (users.length === 0) {
            connection.release();
            console.log(`User with ID ${userId} not found in database`);
            return res.status(404).json({ error: "User not found" });
        }

        const user = users[0];
        console.log(`Found user: ${user.username} (${user.email})`);
        
        console.log('Attempting to insert test result...');
        const [result] = await connection.execute(
            `INSERT INTO test_history (
                user_id, 
                user_name, 
                user_email, 
                test_name, 
                topic, 
                score, 
                total_questions, 
                avg_time, 
                detailed_results, 
                date_taken
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                userId,
                user.username,
                user.email,
                test_name,
                topic,
                score,
                total_questions,
                avg_time,
                JSON.stringify(detailed_results)
            ]
        );
        
        console.log('Test result saved successfully!', result);
        connection.release();
        
        res.json({ 
            success: true,
            message: "Test result saved successfully",
            testId: result.insertId
        });
    } catch (error) {
        if (connection) connection.release();
        
        console.error('Database error saving test result:', error);
        console.error('SQL state:', error.sqlState);
        console.error('SQL message:', error.sqlMessage);
        
        res.status(500).json({ 
            error: 'Failed to save test results',
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                sqlState: error.sqlState,
                sqlMessage: error.sqlMessage
            } : 'Internal server error'
        });
    }
});

app.get('/api/test-history', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id; 
 console.log(`Fetching test history for user ID: ${userId}`);

    const [tests] = await pool.query(`
      SELECT 
        test_id,
        test_name, 
        topic, 
        score, 
        total_questions,
        avg_time,
        date_taken 
      FROM test_history 
      WHERE user_id = ? 
      ORDER BY date_taken DESC
      LIMIT 100`,
      [userId]
    );
console.log(`Found ${tests.length} test results`);
   res.json({
      success: true,
      tests:tests || [] 
    });

  } catch (err) {
    console.error('Error fetching test history:', err);
    res.status(500).json({ 
      success: false,
      error: "Database error",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log("Available endpoints:");
    console.log("- POST /signup");
    console.log("- POST /login");
    console.log("- GET /api/questions");
    console.log("- POST /api/submit-test");
    console.log("- GET /api/get-test-result/:resultId");
});