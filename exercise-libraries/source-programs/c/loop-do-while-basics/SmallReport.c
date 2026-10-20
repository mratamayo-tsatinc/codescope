/*
@codescope
@title Build a short do while report
@seed limit min=2 max=4
*/
#include <stdio.h>

int main(void) {
    int day = 1;
    int limit = 3;
    int points = 0;

    printf("DAILY POINTS\n\n");

    do {
        points += 2;
        printf("day %d points %d\n", day, points);
        day++;
    } while (day <= limit);

    printf("\nTOTAL POINTS: %d\n", points);

    return 0;
}

