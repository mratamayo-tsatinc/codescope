/*
@codescope
@title Boolean expressions
@seed age min=12 max=25
@seed hasID values=0|1
@seed hasTicket values=0|1
*/
public class TaskNovember {
    public static void main(String[] args) {
        int age = 19;
        int hasID = 1;
        int hasTicket = 0;

        System.out.println("age = " + age);
        System.out.println("hasID = " + hasID);
        System.out.println("hasTicket = " + hasTicket);
        System.out.println("canEnterClub: " + ((age >= 18) && (hasID == 1)));
        System.out.println("canWatchMovie: " + ((age >= 13) || (hasTicket == 1)));
        System.out.println("isDenied: " + !((age >= 18) && (hasID == 1)));
        System.out.println("complexCheck: " + (((age > 17) && (hasID == 1)) || ((hasTicket == 1) && (age > 21))));
    }
}
