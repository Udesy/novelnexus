import express, { response } from "express";
import pg from "pg";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import dotenv from "dotenv";

const app = express();
const port =  process.env.DB_PORT || 3000;
const saltRounds = 10;
dotenv.config();

app.use(
    session({
        secret: "TOPSECRETWORD",
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 1000 * 60 * 5
        }
    })
);

const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: true
});

db.connect();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());


app.get("/", (req, res) => {
    res.render("login.ejs")
});

app.get("/register", (req, res) => {
    res.render("register.ejs")
});

app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
    })
);

app.get(
    "/auth/google/books",
    passport.authenticate("google", {
        successRedirect: "/books",
        failureRedirect: "/"
    })
);

app.get("/books", async(req, res) => {
    console.log(req.user);
    if(req.isAuthenticated()){
        const user = req.user
        try{
            const response = await db.query(
                `SELECT * 
                 FROM books
                 JOIN book_reviews ON books.book_id = book_reviews.book_id
                 WHERE books.user_id = $1`,
                 [user.id]
            )
    
            const data = response.rows;
            res.render("index.ejs",{
                data : data,
                user: user.email,
            })
        }catch(error){
            console.log("Error: ", error);
        }
    }else{
        res.redirect("/")
    }
});

app.post("/login", 
    passport.authenticate("local", {
        successRedirect: "/books",
        failureRedirect: "/"
    })
);

app.get("/book", async (req, res) => {
    const bookTitle = req.query.title;
    const bookAuthor = req.query.author;
    const coverId = req.query.coverId;

    try{
        const response = await db.query(
            `SELECT * FROM books
            JOIN book_reviews ON books.book_id = book_reviews.book_id`
        );
        const data = response.rows;
        const bookCheck = data.find((book) => book.book_name === bookTitle)
        const review = bookCheck ? bookCheck.review_text : undefined;
        const book_id = bookCheck ? bookCheck.book_id : undefined
        
        res.render("addbook.ejs", {
            title: bookTitle,
            author: bookAuthor,
            cover : coverId,
            review : review,
            book_id : book_id
        })

    }catch(error){
        console.log("Error: ", error)
    }
});

app.post("/register", async (req, res) => {
     const email = req.body.username;
     const password = req.body.password;

     try{
        const checkResult = await db.query(`
            SELECT * FROM users WHERE email = $1`,
        [email]);

        if(checkResult.rows.length > 0){
            res.send("Email already exist. Try logging in.")
        }else{
            //hashing the password and saving it in the database.
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if(err) {
                    console.error("Error hashing password:", err);
                } else {
                    console.log("Hashed Password:", hash);
                    const response = await db.query(`
                        INSERT INTO users(email, password)
                        VALUES($1, $2) RETURNING *`,
                    [email, hash]
                );
                const user = response.rows[0]
                console.log(user);
                req.login(user, (err) => {
                    console.log("success");
                    res.redirect("/books")
                })
                }
            })
        }
     }catch(err){
        console.log(err);
     }

});


app.post("/updateReview", async(req, res) => {
    const book_id = req.body.bookId;
    const review = req.body.review_text;
    const rating = req.body.rate;
    const date = new Date().toLocaleString();

    try{
        const response = await db.query(`
            UPDATE book_reviews
            SET review_text = $1, rating = $2, review_date = $3
            WHERE book_id = $4
            RETURNING *`,
            [review, rating, date, book_id]);
    
        const data = response.rows;
        console.log(`${review},${rating}, ${date}`);
    }catch(error){
        console.log("Error :", error);
    }
    res.redirect("/books")

});

app.post("/sort", async (req, res) => {
    const sort = req.body.sort;
    try{
        if(sort == "Recent"){
            const response = await db.query(`
                SELECT * 
                FROM books
                JOIN book_reviews ON books.book_id = book_reviews.book_id
                ORDER BY review_date DESC`);

            const data = response.rows;
            res.render("index.ejs",{
                data : data
            });
    
        }if(sort == "Rating"){
            const response = await db.query(`
                SELECT * 
                FROM books
                JOIN book_reviews ON books.book_id = book_reviews.book_id
                ORDER BY rating DESC`);

            const data = response.rows;
            res.render("index.ejs",{
                data : data
            })
        }
        }catch(error){
            console.log("Error: ",error)
    }
});

app.post("/addbook" , async(req, res) => {
    const user = req.user
    const userId = user.id
    const title = req.body.title;
    const author = req.body.author;
    const review = req.body.write_review;
    const rating = req.body.rate;
    const coverId = req.body.cover_id
    const date = new Date().toLocaleString();

    try{
        const newBook = await db.query(`
            INSERT INTO books(book_author, book_name, cover_id, user_id)
            VALUES($1, $2, $3, $4)
            RETURNING book_id`,[author, title, coverId, userId]
        );
        
        const newReview = await db.query(`
            INSERT INTO book_reviews(book_id, review_text, rating, review_date)
            VALUES($1, $2, $3, $4) 
            RETURNING *`,[newBook.rows[0].book_id, review, rating, date]
        );


    }catch(error){
        console.log("An Error Occured: ", error);
    }

    res.redirect("/books")
});

app.post("/delete", async(req, res) => {
    const bookId = req.body.bookId;
    
    try{
        await db.query(`
            DELETE FROM book_reviews
            WHERE book_id = $1`,
            [bookId]);

        await db.query(`
            DELETE FROM books
            WHERE book_id = $1`,
            [bookId]);
    }catch(error){
        console.log("Error : ", error);
    }
    res.redirect("/books")
});

app.use("/logout", (req, res) => {
    req.logout(function (err) {
        if (err) {
          return next(err);
        }
        res.redirect("/");
      });
})

passport.use("local",
    new Strategy(async function verify(username, password, cb) {
        try{
            const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);
            if(result.rows.length > 0){
                const user = result.rows[0];
                const storedHashedPassword = user.password;
                bcrypt.compare(password, storedHashedPassword, (err, valid) => {
                    if(err){
                        //Error with password check
                        console.error("Error comparing password:", err);
                    }else{
                        if(valid){
                            //Passed password check
                            return cb(null, user)
                        }else{
                            //Did not pass password check
                            return cb(null, false)
                        }
                    }
                })
            }else{
                return cb("User not found")
            }
        }catch(err){
            console.log(err);
        }
    })
);

passport.use("google",
    new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/books",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo", 
    },
async(accessToken, refreshToken, profile, cb) => {
    console.log(profile);
    try{
        const response = await db.query("SELECT * FROM users WHERE email = $1", [profile.email]);
        if(response.rows.length === 0){
            const newUser = await db.query("INSERT INTO users(email, password) VALUES($1, $2)", [profile.email, "google"])
            cb(null, newUser.rows[0])
        }else{
            cb(null, response.rows[0])
        }
    }catch(err){
        cb(err)
    }
})
);

passport.serializeUser((user, cb) => {
    cb(null, user);
  });
passport.deserializeUser((user, cb) => {
    cb(null, user);
  });

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
});