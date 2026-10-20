/*
@codescope
@title Repeat a message with while
@seed limit min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int count = 0;
    int limit = 4;

    while (count < limit) {
        printf("Hello, loop! - ");
        printf("Practice makes progress.\n");
        printf("***\n");
        count++;
    }

    printf("FINISHED\n");

    return 0;
}
