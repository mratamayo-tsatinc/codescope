/*
@codescope
@title Assignment before output
@result doubled
*/
#include <stdio.h>

int main() {
    int value = 6;
    int increase = 3;
    int doubled = value * 2;

    value += increase;
    doubled = value * 2;
    printf("Updated value: %d\nDoubled value: %d\n", value, doubled);
    return 0;
}
