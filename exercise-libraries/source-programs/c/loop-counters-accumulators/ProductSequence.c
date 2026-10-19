/*
@codescope
@title Counter and product accumulator
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i = 1;
    int limit = 4;
    int product = 1;

    while (i <= limit) {
        product *= i;
        i++;
    }

    printf("product %d\n", product);

    return 0;
}

