/*
@codescope
@title Switch case selection
@seed day min=1 max=4
*/
#include <stdio.h>

int main() {
    int day = 3;

    switch (day) {
        case 1:
            printf("Monday\n");
            break;
        case 2:
            printf("Tuesday\n");
            break;
        case 3:
            printf("Wednesday\n");
            break;
        default:
            printf("Another day\n");
    }
    return 0;
}
