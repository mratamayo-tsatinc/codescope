/*
@codescope
@title Advance by two
@seed limit min=4 max=8
*/
#include <stdio.h>

int main(void) {
    int number = 0;
    int limit = 6;

    while (number < limit) {
        printf("%d\n", number);
        number += 2;
    }

    printf("final %d\n", number);

    return 0;
}

