/*
@codescope
@title Multiply values in a while loop
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int factor = 1;
    int limit = 4;
    int product = 1;

    while (factor <= limit) {
        product *= factor;
        factor++;
    }

    printf("product %d\n", product);

    return 0;
}

