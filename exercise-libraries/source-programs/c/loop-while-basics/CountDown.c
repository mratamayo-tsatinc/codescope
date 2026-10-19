/*
@codescope
@title Count down with while
@seed count min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int count = 4;

    while (count > 0) {
        printf("%d\n", count);
        count--;
    }

    printf("lift off\n");

    return 0;
}

