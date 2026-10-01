/*
@codescope
@title Combined Boolean conditions
@seed age min=12 max=25
@seed hasID values=0|1
@seed hasTicket values=0|1
*/
#include <stdio.h>

int main() {
    int age = 19;
    int hasID = 1;
    int hasTicket = 0;

    int canEnterClub = (age >= 18) && hasID;
    int canWatchMovie = (age >= 13) || hasTicket;
    int isDenied = !canEnterClub;
    int complexCheck = (age > 17 && hasID == 1) || (hasTicket == 1 && age > 21);

    printf("age = %d, hasID = %d, hasTicket = %d\n", age, hasID, hasTicket);
    printf("canEnterClub: %d\n", canEnterClub);
    printf("canWatchMovie: %d\n", canWatchMovie);
    printf("isDenied: %d\n", isDenied);
    printf("complexCheck: %d\n", complexCheck);

    return 0;
}
