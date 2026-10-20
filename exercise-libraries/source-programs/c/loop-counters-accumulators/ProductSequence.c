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

    printf("\nCOUNTER AND PRODUCT ACCUMULATOR\n");

    while (i <= limit) {
        product *= i;
        i++;
    }

    printf("\n\nACCUMULATED PRODUCT & COUNTER: \n");
    printf("%d\n", product);

    return 0;
}

