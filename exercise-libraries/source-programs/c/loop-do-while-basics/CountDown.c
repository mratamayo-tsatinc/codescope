/*
@codescope
@title Count down with do while
@seed count min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int count = 4;

    do {
        printf("%d\n", count);
        count--;
    } while (count > 0);

    printf("done\n");

    return 0;
}

