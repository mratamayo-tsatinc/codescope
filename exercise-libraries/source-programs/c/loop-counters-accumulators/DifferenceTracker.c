/*
@codescope
@title Subtract with each iteration
@seed limit min=2 max=4
@seed balance min=18 max=24
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 3;
    int balance = 20;

    for (i = 0; i < limit; i++) {
        balance -= 3;
    }

    printf("balance %d\n", balance);

    return 0;
}

