/*
@codescope
@title Follow a multi-statement do body
@seed limit min=2 max=4
*/
#include <stdio.h>

int main(void) {
    int i = 1;
    int limit = 3;
    int value = 0;
    int total = 0;

    do {
        value = i * 3;
        total += value;
        printf("%d\n", value);
        i++;
    } while (i <= limit);

    printf("TOTAL: %d\n", total);

    return 0;
}

