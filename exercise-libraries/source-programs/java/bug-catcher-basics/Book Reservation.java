/*
 * @codescope
 * @title Book Reservation
 * @bug id=bug-1 line=5 token=3 correct="=" wrong="==" choices="==|!="
 * @bug id=bug-2 line=6 token=1 correct="String" wrong="string" choices="string|char"
 * @bug id=bug-3 line=8 token=4 correct="\"Fiction\"" wrong="Fiction" choices="Fiction|fiction"
 * @bug id=bug-4 line=9 token=11 correct="author" wrong="Author" choices="Author|writer"
 */
class BookReservation
{
    public static void main(String[] args)
    {
        String title = "The Great Gatsby";
        String author = "F. Scott Fitzgerald";
        int year = 1925;
        String genre = "Fiction";
        System.out.println(title + " by " + author + " (" + year + ") - " + genre);
    }
}
