/*
@codescope
@title Follow several body statements
@seed limit min=2 max=4
*/
#include <stdio.h>

int main(void) {
    int i = 1;
    int limit = 3;
    int doubled = 0;
    int total = 0;

    while (i <= limit) {
        doubled = i * 2;
        total += doubled;
        printf("%d\n", doubled);
        i++;
    }

    printf("total %d\n", total);

    return 0;
}

