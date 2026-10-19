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

    do {
        points += 2;
        printf("day %d points %d\n", day, points);
        day++;
    } while (day <= limit);

    printf("total %d\n", points);

    return 0;
}

