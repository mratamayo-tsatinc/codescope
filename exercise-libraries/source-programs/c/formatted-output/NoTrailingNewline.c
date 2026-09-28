/*
@codescope
@title Output without a trailing newline
@result difference
*/
#include <stdio.h>

int main() {
    int high = 18;
    int low = 6;
    int difference = high - low;

    printf("%d minus %d equals %d", high, low, difference);
    return 0;
}
