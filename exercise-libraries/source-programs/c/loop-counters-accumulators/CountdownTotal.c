/*
@codescope
@title Accumulate during a countdown
@seed count min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int count = 4;
    int total = 0;

    while (count > 0) {
        total += count;
        count--;
        printf("= %d =\n", total);
    }

    printf("\n\nFINAL TOTAL:\n");
    printf("%d\n", total);

    return 0;
}

