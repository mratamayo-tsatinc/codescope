/*
@codescope
@title Advance by two with do while
@seed limit min=4 max=8
*/
#include <stdio.h>

int main(void) {
    int number = 0;
    int limit = 6;

    printf("ADVANCE BY TWO\n\n");

    do {
        printf("%d\n", number);
        printf("-\n");
        number += 2;
    } while (number < limit);

    printf("FINAL VALUE: %d\n", number);

    return 0;
}

