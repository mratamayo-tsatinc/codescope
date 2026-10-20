/*
@codescope
@title Advance by two
@seed limit min=4 max=8
*/
#include <stdio.h>

int main(void) {
    int number = 0;
    int limit = 6;

    printf("***ADVANCE BY 2***\n\n");

    while (number < limit) {
        printf("%d\n", number);
        printf("-\n");
        number += 2;
    }

    printf("FINAL VALUE: %d\n", number);

    return 0;
}

