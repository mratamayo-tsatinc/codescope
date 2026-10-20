/*
@codescope
@title Model multiplication by addition
@seed times min=3 max=5
@seed amount min=2 max=4
*/
#include <stdio.h>

int main(void) {
    int i = 0;
    int times = 4;
    int amount = 3;
    int total = 0;

    while (i < times) {
        total += amount;
        i++;
        printf("CURRENT TOTAL: %d\n\n", total);
    }

    printf("FINAL TOTAL: %d\n", total);

    return 0;
}

