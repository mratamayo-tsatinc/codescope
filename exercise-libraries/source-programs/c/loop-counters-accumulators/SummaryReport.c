/*
@codescope
@title Produce a final loop summary
@seed limit min=3 max=5
@seed amount min=1 max=3
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 4;
    int amount = 2;
    int total = 0;

    printf("Apply Report Amount\n\n");

    for (i = 1; i <= limit; i++) {

        total += amount;
        printf("step %d total %d\n", i, total);
    }

    printf("Report Now Ready!\n");
    printf("------------------\n");
    printf("Steps %d Final %d\n", limit, total);

    return 0;
}

