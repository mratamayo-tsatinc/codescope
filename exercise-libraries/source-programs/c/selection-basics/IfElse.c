/*
@codescope
@title If else selection
@seed temperature min=20 max=40
*/
#include <stdio.h>

int main() {
    int temperature = 31;

    if (temperature > 30) {
        printf("It is hot.\n");
    } else {
        printf("The temperature is moderate.\n");
    }

    printf("Program terminated!\n");
    return 0;
}
