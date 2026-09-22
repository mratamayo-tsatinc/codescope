/*
@output
age = 19
hasID = 1
hasTicket = 0
canEnterClub: 1
canWatchMovie: 1
isDenied: 0
complexCheck: 1

@variables
canEnterClub = 1
canWatchMovie = 1
isDenied = 0
complexCheck = 1
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

    printf("age = %d\n", age);
    printf("hasID = %d\n", hasID);
    printf("hasTicket = %d\n", hasTicket);
    printf("canEnterClub: %d\n", canEnterClub);
    printf("canWatchMovie: %d\n", canWatchMovie);
    printf("isDenied: %d\n", isDenied);
    printf("complexCheck: %d\n", complexCheck);

    return 0;
}