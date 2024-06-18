import express, { response } from "express";
import pg from "pg";
import bodyParser from "body-parser";
import dotenv from "dotenv";

const app = express();
const port = process.env.DB_PASSWORD || 3000;
dotenv.config();

const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: true
})

db.connect();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.get("/", async(req, res) => {
    try{
        const response = await db.query(
            `SELECT * 
             FROM books
             JOIN book_reviews ON books.book_id = book_reviews.book_id`
        )

        const data = response.rows;
        res.render("index.ejs",{
            data : data
        })
    }catch(error){
        console.log("Error: ", error);
    }
});

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
    res.redirect("/")

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
    const title = req.body.title;
    const author = req.body.author;
    const review = req.body.write_review;
    const rating = req.body.rate;
    const coverId = req.body.cover_id
    const date = new Date().toLocaleString();

    try{
        const newBook = await db.query(`
            INSERT INTO books(book_author, book_name, cover_id)
            VALUES($1, $2, $3)
            RETURNING book_id`,[author, title, coverId]
        );
        
        const newReview = await db.query(`
            INSERT INTO book_reviews(book_id, review_text, rating, review_date)
            VALUES($1, $2, $3, $4) 
            RETURNING *`,[newBook.rows[0].book_id, review, rating, date]
        );


    }catch(error){
        console.log("An Error Occured: ", error);
    }

    res.redirect("/")
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
    res.redirect("/")
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})
