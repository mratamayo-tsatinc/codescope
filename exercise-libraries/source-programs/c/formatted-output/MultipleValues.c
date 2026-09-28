/*
@codescope
@title Multiple values in one printf
@result z
*/
#include <stdio.h>

int main() {
    int x = 12;
    int y = 8;
    int z = x + y;

    printf("Value of x is %d\nand value of y is %d\nand their sum is %d", x, y, z);
    return 0;
}
