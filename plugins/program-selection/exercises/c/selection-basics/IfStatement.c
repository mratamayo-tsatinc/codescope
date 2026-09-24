/*
@codescope
@title Independent if statement
@seed score min=65 max=100
@seed absences min=0 max=8
*/
#include <stdio.h>

int main() {
    int score = 82;
    int absences = 2;

    if (score >= 75 && absences < 5) {
        printf("Requirements met.\n");
    }
    printf("Evaluation complete.\n");
    return 0;
}
