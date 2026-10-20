/*
@codescope
@title Repeat a message with do while
@seed limit min=3 max=5
*/
public class RepeatMessage {
    public static void main(String[] args) {
        int count = 1;
        int limit = 4;

        do {
            System.out.println("Hello, loop!");
            System.out.println("Practice makes progress.");
            count++;
        } while (count <= limit);

        System.out.println("FINISHED");
    }
}
