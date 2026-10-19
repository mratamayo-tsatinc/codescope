/*
@codescope
@title Add values with do while
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i = 1;
    int limit = 4;
    int total = 0;

    do {
        total += i;
        i++;
    } while (i <= limit);

    printf("total %d\n", total);

    return 0;
}

