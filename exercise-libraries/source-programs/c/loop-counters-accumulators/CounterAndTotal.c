/*
@codescope
@title Update two values in the body
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int count = 0;
    int limit = 4;
    int total = 0;

    while (count < limit) {
        count++;
        total += count;
        printf("%d %d\n", count, total);
        printf("---\n");
    }

    printf("final %d\n", total);

    return 0;
}

