/*
@codescope
@title Follow several for body statements
@seed limit min=2 max=4
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 3;
    int value = 0;
    int total = 0;

    for (i = 1; i <= limit; i++) {
        value = i * 2;
        total += value;
        printf("%d\n", value);
    }

    printf("total %d\n", total);

    return 0;
}

