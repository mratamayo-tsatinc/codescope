/*
@codescope
@title Print Shop Job Ticket
@seed pages min=8 max=20 step=2
@seed copies min=2 max=5
@seed pricePerPage min=2 max=4
*/
#include <stdio.h>

int main(void)
{
    int pages = 12;
    int copies = 3;
    int pricePerPage = 2;
    int sheets;
    int jobCost;

    sheets = pages * copies;
    jobCost = sheets * pricePerPage;

    printf("PRINT JOB\n");
    printf("%d pages x %d copies\n", pages, copies);
    printf("Sheets required: %d\n", sheets);
    printf("Job cost: P%d\n", jobCost);

    return 0;
}

