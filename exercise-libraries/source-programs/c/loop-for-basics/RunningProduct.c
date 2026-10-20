/*
@codescope
@title Multiply values with for
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i;
    int limit = 4;
    int product = 1;

    for (i = 1; i <= limit; i++) {
        product *= i;
        printf("%d\n", product);
    }

    printf("FINAL PRODUCT: %d\n", product);

    return 0;
}

