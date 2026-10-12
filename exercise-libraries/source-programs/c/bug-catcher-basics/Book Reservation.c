/*
 * @codescope
 * @title Book Reservation
 * @bug id=bug-1 line=1 token=4 correct="stdio" wrong="studio" choices="studio|std"
 * @bug id=bug-2 line=5 token=5 correct="=" wrong="==" choices="==|!="
 * @bug id=bug-3 line=8 token=6 correct="\"Fiction\"" wrong="Fiction" choices="Fiction|fiction"
 * @bug id=bug-4 line=10 token=6 correct="\"12345\"" wrong="12345" choices="12345|1234"
 * @bug id=bug-5 line=12 token=7 correct="author" wrong="Author" choices="Author|writer"
 * @bug id=bug-6 line=13 token=4 correct="," wrong="+" choices="+|."
 * @bug id=bug-7 line=14 token=4 correct="," wrong="+" choices="+|."
 * @bug id=bug-8 line=15 token=4 correct="," wrong="." choices=".|+"
 * @bug id=bug-9 line=16 token=4 correct="," wrong="." choices=".|+"
 */
#include <stdio.h>

int main()
{
    char title[] = "The Great Gatsby";
    char author[] = "F. Scott Fitzgerald";
    int year = 1925;
    char genre[] = "Fiction";
    char library[] = "Central Library";
    char memberID[] = "12345";
    char returnDate[] = "June 30, 2023";
    printf("You have successfully reserved the book '%s' by %s.\n", title, author);
    printf("Year of Publication: %d\n", year);
    printf("Genre: %s\n", genre);
    printf("Library: %s\n", library);
    printf("Member ID: %s\n", memberID);
    printf("Return Date: %s\n", returnDate);
    return 0;
}
