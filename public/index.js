document.addEventListener("DOMContentLoaded", function() {
    const searchInput = document.getElementById("searchInput");
    const dropdownList = document.getElementById("dropdownList");

    const debounce = function(func, delay){
        let timeoutId;
        return(...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func(...args);
            }, delay);
        };
    }

    const handleDebounceInput = async function() {
        const searchTerm = searchInput.value.trim();
        console.log("Search Term: ", searchTerm);
        
        try{
            const { bookTitle, bookAuthor, coverId} = await fetchData(searchTerm);

            console.log("Searched Book: ", bookTitle);
            console.log("Cover Id: ", coverId);
            console.log("Book Author: ",bookAuthor);
            await updateDropdown(bookTitle, coverId, bookAuthor, dropdownList);

        } catch(error){
            console.error("Error updating dropdown :",error);
        }
    }
    
    searchInput.addEventListener('input',debounce(handleDebounceInput,300));

    document.addEventListener("click", function(event) {
        if(!event.target.closest('.dropdown')){
            dropdownList.style.display = 'none';
        }
    });

})

async function fetchData(searchTerm){
    // console.log(data);
    try{
        const response = await fetch(`https://openlibrary.org/search.json?q=${searchTerm}&limit=6`)
        if(!response.ok){
            throw new Error(`HTTP error! Status: ${response.status}`)
        }

        const data = await response.json();
        console.log(data);
        const result = data.docs;
        const bookTitle = result.map((book) => book.title);
        const bookAuthor = result.map((book) => book.author_name ? book.author_name[0]: "Unknown");
        const coverId = result.map((book) => book.cover_i);

        return {
            bookTitle : bookTitle,
            bookAuthor : bookAuthor,
            coverId : coverId
        };
    }
    catch(error){
        console.error("Error in fectching data : ", error);
    } 
}

async function updateDropdown(items, coverId, bookAuthor, dropdownList) {
    //create list items based on the fetch results. 
       
    const html = items.map((item, index) =>
        `<a href="/book?title=${item}&author=${bookAuthor[index]}&coverId=${coverId[index]? coverId[index]: 0}">
        <li class="listItem">
        <img src="https://covers.openlibrary.org/b/id/${coverId[index]}-S.jpg?default=https://openlibrary.org/static/images/icons/avatar_book-sm.png" width="40" height="60" alt="book picture">
        <div id= "book-info">
        <p><strong>${item}</strong></p>
        <p>By ${bookAuthor[index]}</p>
        </div>
        </li>
        </a>`).join('');
    dropdownList.innerHTML = html;    

    // Show/hide dropdown
    if (items.length > 0) {
        dropdownList.style.display = 'block';
    } else {
        dropdownList.style.display = 'none';
    }

}