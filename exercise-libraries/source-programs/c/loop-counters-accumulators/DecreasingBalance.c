/*
@codescope
@title Track a changing balance
@seed limit min=2 max=4
@seed balance min=14 max=18
*/
#include <stdio.h>

int main(void) {
    int step = 1;
    int limit = 3;
    int balance = 15;

    do {
        balance -= step;
        step++;
    } while (step <= limit);

    printf("balance %d\n", balance);

    return 0;
}

