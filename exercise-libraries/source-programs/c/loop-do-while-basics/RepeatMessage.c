/*
@codescope
@title Repeat a message with do while
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int count = 1;
    int limit = 4;

    do {
        printf("Hello, loop!\n");
        printf("Practice makes progress.\n");
        count++;
    } while (count <= limit);

    printf("FINISHED\n");

    return 0;
}
